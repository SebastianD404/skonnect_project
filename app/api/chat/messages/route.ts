import { NextRequest, NextResponse } from "next/server";
import type { ChatMessageRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { detectLanguage } from "@/lib/chatbot/language";
import { runRagAnswer } from "@/lib/chatbot/rag";

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
      return NextResponse.json({ messages: [] });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") || 20), 50);

    const messages = await prisma.chatMessage.findMany({
      where: { userId: authorizedUser.id },
      orderBy: { createdAt: "desc" },
      take: Number.isFinite(limit) ? limit : 20,
      select: {
        id: true,
        role: true,
        content: true,
        language: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      messages: messages.reverse(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load messages";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
    const db = prisma;
    const activeGranteeCount = await db.grantee.count({
      where: {
        status: "ACTIVE",
      },
    });

    if (!authorizedUser) {
      const assistantText = await runRagAnswer({
        question: userMessage,
        language,
        history: [],
        liveSystemContext: `Current Update: We are currently supporting ${activeGranteeCount} active SKEAP scholars this semester. If the user asks about the current count, use this number and ignore any conflicting figures from older context.`,
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
      liveSystemContext: `Current Update: We are currently supporting ${activeGranteeCount} active SKEAP scholars this semester. If the user asks about the current count, use this number and ignore any conflicting figures from older context.`,
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
