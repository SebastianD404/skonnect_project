import { NextRequest, NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { GRANTEE_PLACEHOLDER_SCHOOL, GRANTEE_PLACEHOLDER_YEAR_LEVEL } from "@/lib/grantee-profile";
import { logAuditEvent, writeAuditLog } from "@/lib/audit/logger";
import { ensureThreadMessage } from "@/lib/inquiries/thread";

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
  if (typeof value !== "object" || value === null) return false;
  const note = value as Record<string, unknown>;
  return (
    typeof note.fileId === "string" &&
    typeof note.fileName === "string" &&
    typeof note.fileUrl === "string" &&
    typeof note.fileType === "string" &&
    typeof note.adminRemark === "string"
  );
}

function isValidReviewMessage(value: unknown): value is ReviewMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Record<string, unknown>;
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
    if ("error" in auth) {
      return auth.error;
    }

    const appUser = auth.user;
    const body = await request.json();
    const action = String(body.action ?? "").trim();
    const text = String(body.text ?? "").trim();
    const attachments = Array.isArray(body.attachments)
      ? body.attachments.filter(isValidAttachedFileNote)
      : [];

    if (!id) {
      return NextResponse.json({ error: "Missing inquiry id" }, { status: 400 });
    }

    if (action !== "message" && action !== "reply" && action !== "resolve" && action !== "reopen" && action !== "approve") {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }

    if ((action === "message" || action === "reply") && !text && attachments.length === 0) {
      return NextResponse.json({ error: "Message text or attachments are required" }, { status: 400 });
    }

    const inquiry = await prisma.inquiry.findUnique({
      where: { id },
      select: {
        reviewThread: true,
        message: true,
        createdAt: true,
        userId: true,
        application: { select: { school: true, yearLevel: true, applicantName: true } },
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

    const isStatusOnlyAction = action === "resolve" || action === "reopen";
    const updatedThread = (isStatusOnlyAction ? existingThread : [message, ...existingThread]) as unknown as Prisma.InputJsonArray;

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
      updateData.response = message.text;
      updateData.respondedAt = new Date();
      updateData.lastUpdatedBy = "admin";

      if (isReturnedUpdate) {
        updateData.reviewStatus = "Returned";
        updateData.isResolved = true;
      }
    }

    if (action === "reply") {
      updateData.response = message.text;
      updateData.respondedAt = new Date();
      updateData.lastUpdatedBy = "admin";
    }

    if (action === "resolve") {
      updateData.isResolved = true;
      updateData.lastUpdatedBy = "admin";
    }

    if (action === "reopen") {
      updateData.isResolved = false;
      updateData.lastUpdatedBy = "admin";
    }

    if (action === "approve") {
      updateData.reviewStatus = "Approved";
      updateData.response = message.text;
      updateData.respondedAt = new Date();
      updateData.isResolved = true;
      updateData.lastUpdatedBy = "admin";
    }

    const updatedInquiry = await prisma.$transaction(async (tx) => {
      const currentInquiry = await (tx as any).inquiry.findUnique({
        where: { id },
        select: {
          reviewThread: true,
          message: true,
          createdAt: true,
          userId: true,
          user: { select: { grantee: { select: { status: true } } } },
          application: { select: { id: true, status: true, school: true, currentCourse: true, yearLevel: true, applicantName: true } },
        },
      });

      if (action === "approve" && currentInquiry?.user?.grantee?.status === "GRADUATED") {
        throw new Error("GRANTEE_ARCHIVED");
      }
      if (action === "approve" && currentInquiry?.application?.status === "WAITLISTED") {
        throw new Error("Waitlisted applications must be promoted from the waitlist before approval.");
      }

      const existingThreadFromTx = (Array.isArray(currentInquiry?.reviewThread)
        ? currentInquiry.reviewThread.filter(isValidReviewMessage)
        : []) as unknown as ReviewMessage[];
      const threadWithOriginalMessage = currentInquiry
        ? ensureThreadMessage(existingThreadFromTx, {
            id: `inquiry-${id}`,
            role: "applicant" as const,
            createdAt: currentInquiry.createdAt.toISOString(),
            text: currentInquiry.message,
          })
        : existingThreadFromTx;

      const updatedThreadFromTx = (
        isStatusOnlyAction ? threadWithOriginalMessage : [message, ...threadWithOriginalMessage]
      ) as unknown as Prisma.InputJsonArray;

      const updated = await (tx as any).inquiry.update({
        where: { id },
        data: {
          ...updateData,
          reviewThread: updatedThreadFromTx,
        },
      });

      if (action === "approve" && currentInquiry?.userId) {
        if (currentInquiry.application?.id) {
          await (tx as any).skeapApplication.update({
            where: { id: currentInquiry.application.id },
            data: { status: "APPROVED", waitlistPosition: null },
          });
        }

        const targetUser = await (tx as any).user.findUnique({
          where: { id: currentInquiry.userId },
          select: { id: true, role: true },
        });

        if (targetUser?.role === Role.YOUTH || targetUser?.role === Role.GRANTEE) {
          const previousRole = targetUser.role;

          await (tx as any).user.update({
            where: { id: targetUser.id },
            data: {
              role: Role.GRANTEE,
            },
          });

          await writeAuditLog(tx as any, {
            action: "APPROVE_SKEAP_APPLICATION",
            actorId: appUser.id,
            targetTable: "users",
            targetId: targetUser.id,
            beforeData: {
              role: previousRole,
            },
            afterData: {
              role: Role.GRANTEE,
            },
            metadata: {
              target: currentInquiry.application?.applicantName || currentInquiry.userId,
              targetId: targetUser.id,
              targetEmail: undefined,
              applicantName: currentInquiry.application?.applicantName,
            },
          });

          await (tx as any).grantee.upsert({
            where: { userId: targetUser.id },
            create: {
              userId: targetUser.id,
              school:
                currentInquiry.application?.school ||
                currentInquiry.application?.currentCourse ||
                GRANTEE_PLACEHOLDER_SCHOOL,
              yearLevel: currentInquiry.application?.yearLevel ?? GRANTEE_PLACEHOLDER_YEAR_LEVEL,
              status: "ACTIVE",
            },
            update: {
              school:
                currentInquiry.application?.school ||
                currentInquiry.application?.currentCourse ||
                GRANTEE_PLACEHOLDER_SCHOOL,
              yearLevel: currentInquiry.application?.yearLevel ?? GRANTEE_PLACEHOLDER_YEAR_LEVEL,
            },
          });
        }
      }

      return updated;
    });

    if (action === "resolve") {
      logAuditEvent({
        actorId: appUser.id,
        actorEmail: appUser.email,
        action: "INQUIRY_RESOLVED",
        resource: "inquiries",
        resourceId: id,
        metadata: { resultingStatus: "RESOLVED", applicantId: inquiry.userId },
      });
    } else if (action === "reopen") {
      logAuditEvent({
        actorId: appUser.id,
        actorEmail: appUser.email,
        action: "INQUIRY_REOPENED",
        resource: "inquiries",
        resourceId: id,
        metadata: { resultingStatus: "OPEN", applicantId: inquiry.userId },
      });
    } else if (action === "approve") {
      logAuditEvent({
        actorId: appUser.id,
        actorEmail: appUser.email,
        action: "APPLICATION_APPROVED",
        resource: "inquiries",
        resourceId: id,
        metadata: {
          applicantId: inquiry.userId,
          target: inquiry.application?.applicantName || inquiry.userId,
          resultingStatus: updatedInquiry.reviewStatus ?? "Approved",
        },
      });
    }

    revalidatePath("/admin/skeap-applications");
    revalidatePath("/admin");
    revalidatePath("/admin/inquiries");
    revalidatePath(`/applications/${id}`);

    return NextResponse.json({
      success: true,
      reviewThread: updatedInquiry.reviewThread,
      reviewStatus: updatedInquiry.reviewStatus ?? undefined,
      response: updatedInquiry.response ?? null,
      respondedAt: updatedInquiry.respondedAt?.toISOString() ?? null,
      isResolved: updatedInquiry.isResolved,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update inquiry";
    console.error("Inquiry update failed:", error);
    if (message === "GRANTEE_ARCHIVED") {
      return NextResponse.json({ error: "Graduated Grantee records cannot be changed by application approval." }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
