import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const db = prisma;

type ThreadMessage = {
  id: string;
  role: "admin" | "applicant";
  createdAt: string;
  text: string;
};

function isThreadMessage(value: unknown): value is ThreadMessage {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (item.role === "admin" || item.role === "applicant") &&
    typeof item.id === "string" && typeof item.createdAt === "string" && typeof item.text === "string";
}

async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return ensureProfile(user);
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await getCurrentUser();
  if (!appUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const inquiry = await db.inquiry.findFirst({
    where: { id, userId: appUser.id },
    select: { id: true, subject: true, message: true, response: true, createdAt: true, isResolved: true, reviewThread: true },
  });
  if (!inquiry) return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });

  const thread = Array.isArray(inquiry.reviewThread) ? inquiry.reviewThread.filter(isThreadMessage) : [];
  if (thread.length === 0) {
    thread.push({ id: `inquiry-${inquiry.id}`, role: "applicant", createdAt: inquiry.createdAt.toISOString(), text: inquiry.message });
    if (inquiry.response) {
      thread.push({ id: `response-${inquiry.id}`, role: "admin", createdAt: inquiry.createdAt.toISOString(), text: inquiry.response });
    }
  }

  thread.sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  return NextResponse.json({ inquiry: { ...inquiry, thread } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const appUser = await getCurrentUser();
    if (!appUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const body = await request.json();
    const text = String(body.text ?? "").trim();
    if (!text) return NextResponse.json({ error: "Reply text is required." }, { status: 400 });

    const inquiry = await db.inquiry.findFirst({ where: { id, userId: appUser.id }, select: { id: true, reviewThread: true } });
    if (!inquiry) return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });

    const existingThread = Array.isArray(inquiry.reviewThread) ? inquiry.reviewThread.filter(isThreadMessage) : [];
    const reply: ThreadMessage = { id: `applicant-${Date.now()}`, role: "applicant", createdAt: new Date().toISOString(), text };
    const reviewThread = [reply, ...existingThread] as unknown as Prisma.InputJsonArray;

    await db.inquiry.update({
      where: { id },
      data: { message: text, response: null, respondedAt: null, isResolved: false, lastUpdatedBy: "applicant", reviewThread },
    });

    return NextResponse.json({ reply });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send reply.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}