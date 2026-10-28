import { NextRequest, NextResponse } from "next/server";
import type { ChatMessageRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { detectLanguage } from "@/lib/chatbot/language";
import { runRagAnswer } from "@/lib/chatbot/rag";
import { checkChatIpRateLimit } from "@/lib/chatbot/ip-rate-limit";
import { getAcademicTermScheduleState } from "@/lib/academic-term-schedule";
import type { LiveSubmissionSchedules } from "@/lib/chatbot/submission-schedule";

function formatLiveDate(value: string | null) {
  if (!value) return "Not configured";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not configured";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(date);
}

function formatManilaNow(value: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "long",
    timeStyle: "long",
    timeZone: "Asia/Manila",
  }).format(value);
}

function buildLiveSystemContext(params: {
  activeGranteeCount: number;
  academicTermWindow: Awaited<ReturnType<typeof getAcademicTermScheduleState>>["window"];
  activeAdminNotice: { title: string; content: string } | null;
  currentTime: Date;
}) {
  const { academicTermWindow, activeAdminNotice } = params;
  const announcement = activeAdminNotice
    ? JSON.stringify(`${activeAdminNotice.title}: ${activeAdminNotice.content}`.slice(0, 1200))
    : "None";

  return [
    "[LIVE SYSTEM CONFIGURATION & SCHEDULES]",
    "[LIVE SYSTEM SCHEDULE]",
    `- Current System Time: ${formatManilaNow(params.currentTime)} (Asia/Manila).`,
    `- Active Term Name: ${academicTermWindow.semester ?? "No active or upcoming term configured"}.`,
    `- Schedule Status: ${academicTermWindow.status}.`,
    `- Term Opens On: ${formatLiveDate(academicTermWindow.opensAt)}.`,
    `- Term Deadline: ${formatLiveDate(academicTermWindow.closesAt)}.`,
    "[END LIVE SYSTEM SCHEDULE]",
    "- SKEAP Scholarship Submissions Currently Open: YES (SKEAP currently accepts applications; no separate admin-managed application dates are configured).",
    "- SKEAP Application Start Date: Not configured.",
    "- SKEAP Application End Date: Not configured.",
    "- KK Profiling Submissions Currently Open: YES (no admin-managed opening or closing dates are configured).",
    "- KK Profiling Start Date: Not configured.",
    "- KK Profiling End Date: Not configured.",
    `- Grantee Academic Document Submission Schedule: ${academicTermWindow.status}.`,
    `- Academic Submission Term: ${academicTermWindow.semester ?? "Not configured"}.`,
    `- Academic Submission Opens: ${formatLiveDate(academicTermWindow.opensAt)}.`,
    `- Academic Submission Closes: ${formatLiveDate(academicTermWindow.closesAt)}.`,
    `- Active Admin Notice: ${announcement}.`,
    `- Current Active SKEAP Scholars: ${params.activeGranteeCount}.`,
    "[END LIVE SYSTEM CONFIGURATION]",
  ].join("\n");
}

type AuthorizedUser = {
  id: string;
  role: "YOUTH" | "GRANTEE";
};

async function getAuthorizedUser(): Promise<AuthorizedUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const appUser = await prisma.user.findFirst({
    where: {
      OR: [{ authId: user.id }, { email: user.email ?? "" }],
    },
    select: { id: true, authId: true, role: true },
  });

  if (!appUser) {
    return null;
  }

  if (appUser.authId !== user.id) {
    try {
      await prisma.user.update({
        where: { id: appUser.id },
        data: { authId: user.id },
      });
    } catch {
      // Best-effort relink only.
    }
  }

  if (appUser.role !== "YOUTH" && appUser.role !== "GRANTEE") {
    return null;
  }

  return { id: appUser.id, role: appUser.role };
}

export async function GET(request: NextRequest) {
  try {
    const authorizedUser = await getAuthorizedUser();
    if (!authorizedUser) {
      return NextResponse.json({ messages: [], totalConversations: 0 });
    }

    const { searchParams } = new URL(request.url);
    const requestedLimit = Number(searchParams.get("limit") || 20);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.floor(requestedLimit), 1), 50)
      : 20;
    const cursorId = searchParams.get("cursor");
    const cursorMessage = cursorId
      ? await prisma.chatMessage.findFirst({
          where: { id: cursorId, userId: authorizedUser.id },
          select: { id: true, createdAt: true },
        })
      : null;

    const messageWhere = cursorMessage
      ? {
          userId: authorizedUser.id,
          OR: [
            { createdAt: { lt: cursorMessage.createdAt } },
            {
              createdAt: cursorMessage.createdAt,
              id: { lt: cursorMessage.id },
            },
          ],
        }
      : { userId: authorizedUser.id };

    const [messages, totalConversations] = await Promise.all([
      prisma.chatMessage.findMany({
        where: messageWhere,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
        select: {
          id: true,
          role: true,
          content: true,
          language: true,
          createdAt: true,
        },
      }),
      prisma.chatMessage.count({
        where: { userId: authorizedUser.id, role: "USER" },
      }),
    ]);

    return NextResponse.json({
      messages,
      totalConversations,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load messages";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const forwardedIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = request.headers.get("x-real-ip")?.trim() || forwardedIp || "unknown";
  const rateLimit = checkChatIpRateLimit(ip);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
          "Cache-Control": "no-store",
        },
      }
    );
  }

  try {
    const authorizedUser = await getAuthorizedUser();
    const body = (await request.json()) as { message?: string };
    const userMessage = String(body.message ?? "").trim();

    if (!userMessage) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    if (userMessage.length > 4000) {
      return NextResponse.json({ error: "Message is too long" }, { status: 400 });
    }

    const language = detectLanguage(userMessage);
    const [activeGranteeCount, { window: academicTermWindow }, activeAdminNotice] = await Promise.all([
      prisma.grantee.count({ where: { status: "ACTIVE" } }),
      getAcademicTermScheduleState(),
      prisma.announcement.findFirst({
        where: { isPublished: true },
        orderBy: { publishedAt: "desc" },
        select: { title: true, content: true },
      }),
    ]);
    const liveSubmissionSchedules: LiveSubmissionSchedules = {
      skeap: { isOpen: true, startDate: null, endDate: null },
      kkProfiling: { isOpen: true, startDate: null, endDate: null },
      academicTerm: academicTermWindow,
    };
    const liveSystemContext = buildLiveSystemContext({
      activeGranteeCount,
      academicTermWindow,
      activeAdminNotice,
      currentTime: new Date(),
    });

    if (!authorizedUser) {
      const assistantText = await runRagAnswer({
        question: userMessage,
        language,
        history: [],
        liveSystemContext,
        liveSubmissionSchedules,
      });

      await prisma.chatLog.create({
        data: {
          userId: null,
          question: userMessage,
          detectedLanguage: language,
          answer: assistantText.response,
        },
      });

      const guestUserMessage = {
        id: `guest-${Date.now()}-user`,
        role: "USER" as ChatMessageRole,
        content: userMessage,
        language,
        createdAt: new Date().toISOString(),
      };

      const guestAssistantMessage = {
        id: `guest-${Date.now()}-assistant`,
        role: "ASSISTANT" as ChatMessageRole,
        content: assistantText.response,
        language,
        createdAt: new Date().toISOString(),
      };

      return NextResponse.json({
        message: guestAssistantMessage,
        userMessage: guestUserMessage,
        chunksUsed: assistantText.chunksUsed,
        sources: assistantText.sources,
      });
    }

    const createdUserMessage = await prisma.chatMessage.create({
      data: {
        userId: authorizedUser.id,
        role: "USER" as ChatMessageRole,
        content: userMessage,
        language,
      },
      select: {
        id: true,
        role: true,
        content: true,
        language: true,
        createdAt: true,
      },
    });

    const recentMessages = await prisma.chatMessage.findMany({
      where: { userId: authorizedUser.id },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        role: true,
        content: true,
      },
    });

    const assistantText = await runRagAnswer({
      question: userMessage,
      language,
      history: recentMessages.reverse().map((message) => ({
        role: message.role === "ASSISTANT" ? "assistant" : "user",
        content: message.content,
      })),
      liveSystemContext,
      liveSubmissionSchedules,
    });

    const createdAssistantMessage = await prisma.chatMessage.create({
      data: {
        userId: authorizedUser.id,
        role: "ASSISTANT" as ChatMessageRole,
        content: assistantText.response,
        language,
      },
      select: {
        id: true,
        role: true,
        content: true,
        language: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      message: createdAssistantMessage,
      userMessage: createdUserMessage,
      chunksUsed: assistantText.chunksUsed,
      sources: assistantText.sources,
    });
  } catch (error) {
    const isError = error instanceof Error;
    const message = isError ? error.message : "Failed to process chat message";
    const stack = isError ? error.stack : undefined;
    const isGeminiIssue = /Gemini|GOOGLE_GEMINI_API_KEY/.test(message);
    const isDebug = process.env.NODE_ENV !== "production";

    console.error("CHAT MESSAGE ERROR", {
      message,
      stack,
      isGeminiIssue,
      route: "/api/chat/messages",
    });

    return NextResponse.json(
      {
        error: isDebug
          ? message
          : isGeminiIssue
          ? "The assistant is temporarily unavailable. Please try again in a moment."
          : message,
      },
      { status: 500 }
    );
  }
}
