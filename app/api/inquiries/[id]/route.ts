import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";

interface AttachedFileNote {
  fileId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  adminRemark: string;
}

interface ReviewMessage {
  id: string;
  role: "admin" | "applicant";
  createdAt: string;
  text: string;
  attachments?: AttachedFileNote[];
}

async function authorizeReviewUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const appUser = await ensureProfile(user);
  if (!appUser) {
    return { error: NextResponse.json({ error: "User not found" }, { status: 401 }) };
  }

  if (appUser.role !== "SK_OFFICIAL" && appUser.role !== "SUPER_ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user: appUser };
}

function isValidAttachedFileNote(value: unknown): value is AttachedFileNote {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as any).fileId === "string" &&
    typeof (value as any).fileName === "string" &&
    typeof (value as any).fileUrl === "string" &&
    typeof (value as any).fileType === "string" &&
    typeof (value as any).adminRemark === "string"
  );
}

function isValidReviewMessage(value: unknown): value is ReviewMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as any;
  if (message.role !== "admin" && message.role !== "applicant") return false;
  if (typeof message.id !== "string" || typeof message.createdAt !== "string") return false;
  if (typeof message.text !== "string") return false;
  if (message.attachments !== undefined) {
    if (!Array.isArray(message.attachments)) return false;
    if (!message.attachments.every(isValidAttachedFileNote)) return false;
  }
  return true;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await authorizeReviewUser();
    if (auth.error) {
      return auth.error;
    }

    const body = await request.json();
    const action = String(body.action ?? "").trim();
    const text = String(body.text ?? "").trim();
    const attachments = Array.isArray(body.attachments)
      ? body.attachments.filter(isValidAttachedFileNote)
      : [];

    if (!id) {
      return NextResponse.json({ error: "Missing inquiry id" }, { status: 400 });
    }

    if (action !== "message" && action !== "approve") {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }

    if (action === "message" && !text && attachments.length === 0) {
      return NextResponse.json({ error: "Message text or attachments are required" }, { status: 400 });
    }

    const inquiry = await prisma.inquiry.findUnique({
      where: { id },
      select: {
        reviewThread: true,
      },
    });

    if (!inquiry) {
      return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
    }

    const existingThread = (Array.isArray(inquiry.reviewThread)
      ? inquiry.reviewThread.filter(isValidReviewMessage)
      : []) as unknown as ReviewMessage[];

    const message: ReviewMessage = {
      id: `admin-${Date.now()}`,
      role: "admin",
      createdAt: new Date().toISOString(),
      text: action === "approve" && !text ? "Application approved. We will move this applicant to the next step." : text,
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    const updatedThread = [message, ...existingThread] as unknown as Prisma.InputJsonArray;

    const updateData: {
      reviewThread: Prisma.InputJsonValue;
      response?: string;
      respondedAt?: Date;
      isResolved?: boolean;
      reviewStatus?: string;
      lastUpdatedBy?: string;
    } = {
      reviewThread: updatedThread,
    };

    const isReturnedUpdate =
      action === "message" &&
      (attachments.length > 0 || /returned|correction|required|resubmit|revise|revision/i.test(text));

    if (action === "message") {
      if (isReturnedUpdate) {
        updateData.reviewStatus = "Returned";
        updateData.response = message.text;
        updateData.respondedAt = new Date();
        updateData.isResolved = true;
        updateData.lastUpdatedBy = "admin";
      }
    }

    if (action === "approve") {
      updateData.reviewStatus = "Approved";
      updateData.response = message.text;
      updateData.respondedAt = new Date();
      updateData.isResolved = true;
      updateData.lastUpdatedBy = "admin";
    }

    const updatedInquiry = await prisma.$transaction(async (tx) => {
      const currentInquiry = await tx.inquiry.findUnique({
        where: { id },
        select: { reviewThread: true },
      });

      const existingThreadFromTx = (Array.isArray(currentInquiry?.reviewThread)
        ? currentInquiry!.reviewThread
        : []) as unknown as ReviewMessage[];

      const updatedThreadFromTx = [message, ...existingThreadFromTx] as unknown as Prisma.InputJsonArray;

      return tx.inquiry.update({
        where: { id },
        data: {
          ...updateData,
          reviewThread: updatedThreadFromTx,
        },
      });
    });

    revalidatePath("/admin/skeap-applications");
    revalidatePath("/admin");

    return NextResponse.json({
      success: true,
      reviewThread: updatedInquiry.reviewThread,
      reviewStatus: updatedInquiry.reviewStatus ?? undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update inquiry";
    console.error("Inquiry update failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
