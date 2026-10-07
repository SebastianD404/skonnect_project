import { NextRequest, NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { GRANTEE_PLACEHOLDER_SCHOOL, GRANTEE_PLACEHOLDER_YEAR_LEVEL } from "@/lib/grantee-profile";
import { logAuditEvent, writeAuditLog } from "@/lib/audit/logger";
import { ensureThreadMessage } from "@/lib/inquiries/thread";
import { normalizeUploadedFiles } from "@/lib/skeap-upload";
import { ACTIVE_SKEAP_APPLICATION_WHERE, getSkeapMaxSlots } from "@/lib/skeap-capacity";

interface AttachedFileNote {
  fileId: string;
  documentLabel?: string;
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
  action?: "return";
  eventType?: "RESUBMISSION";
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
    typeof note.adminRemark === "string" &&
    (note.documentLabel === undefined || typeof note.documentLabel === "string")
  );
}

function isValidReviewMessage(value: unknown): value is ReviewMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Record<string, unknown>;
  if (message.role !== "admin" && message.role !== "applicant") return false;
  if (typeof message.id !== "string" || typeof message.createdAt !== "string") return false;
  if (typeof message.text !== "string") return false;
  if (message.action !== undefined && message.action !== "return") return false;
  if (message.eventType !== undefined && message.eventType !== "RESUBMISSION") return false;
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

    if (action !== "message" && action !== "reply" && action !== "resolve" && action !== "reopen" && action !== "approve" && action !== "return") {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }

    if ((action === "message" || action === "reply" || action === "return") && !text && attachments.length === 0) {
      return NextResponse.json({ error: "Message text or attachments are required" }, { status: 400 });
    }
    if (action === "return" && !text) {
      return NextResponse.json({ error: "Required corrections are needed to return this application" }, { status: 400 });
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
      action: action === "return" ? "return" : undefined,
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

    if (action === "message") {
      updateData.response = message.text;
      updateData.respondedAt = new Date();
      updateData.lastUpdatedBy = "admin";
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

    if (action === "return") {
      updateData.reviewStatus = "Returned";
      updateData.response = message.text;
      updateData.respondedAt = new Date();
      updateData.isResolved = true;
      updateData.lastUpdatedBy = "admin";
    }

    const maxSlots = action === "approve" ? await getSkeapMaxSlots() : null;
    const updatedInquiry = await prisma.$transaction(async (tx) => {
      const currentInquiry = await tx.inquiry.findUnique({
        where: { id },
        select: {
          reviewThread: true,
          message: true,
          createdAt: true,
          userId: true,
          reviewStatus: true,
          user: { select: { grantee: { select: { status: true } } } },
          application: { select: { id: true, status: true, school: true, currentCourse: true, yearLevel: true, applicantName: true, uploadedFiles: true } },
        },
      });

      if (action === "return") {
        const currentReviewStatus = String(currentInquiry?.reviewStatus || "").toLowerCase();
        const currentApplicationStatus = currentInquiry?.application?.status;
        if (
          !currentInquiry ||
          !currentInquiry.application?.id ||
          !(/pending|resubmitted|resubmit/.test(currentReviewStatus)) ||
          (currentApplicationStatus !== "PENDING" && currentApplicationStatus !== "RETURNED_FOR_EDIT")
        ) {
          throw new Error("This application is no longer eligible to be returned for edits.");
        }
      }

      if (action === "approve" && currentInquiry?.user?.grantee?.status === "GRADUATED") {
        throw new Error("GRANTEE_ARCHIVED");
      }
      if (action === "approve" && currentInquiry?.application?.status === "WAITLISTED") {
        throw new Error("Waitlisted applications must be promoted from the waitlist before approval.");
      }
      if (action === "approve" && currentInquiry?.application?.status === "APPROVED") {
        throw new Error("This application has already been approved.");
      }

      let approvalStatus: "APPROVED" | "WAITLISTED" | undefined;
      let approvalMessage = message;
      let waitlistPosition: number | null = null;
      if (action === "approve") {
        if (!currentInquiry?.application?.id || maxSlots === null) {
          throw new Error("The linked SKEAP application could not be found.");
        }
        const activeCount = await tx.skeapApplication.count({
          where: ACTIVE_SKEAP_APPLICATION_WHERE,
        });
        approvalStatus = activeCount >= maxSlots ? "WAITLISTED" : "APPROVED";
        if (approvalStatus === "WAITLISTED") {
          waitlistPosition = (await tx.skeapApplication.count({ where: { status: "WAITLISTED" } })) + 1;
        }
        const applicantName = currentInquiry.application.applicantName || "Applicant";
        const approvalText = approvalStatus === "WAITLISTED"
          ? `Dear ${applicantName}, your SKEAP application has been approved and placed on the scholarship waitlist at position ${waitlistPosition}. Promotion and capacity management will be handled there.`
          : `Dear ${applicantName}, your SKEAP application has been successfully approved. You have been granted an active scholarship slot for Barangay Pico. Please check your portal for next steps.`;
        approvalMessage = { ...message, text: approvalText };
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
        isStatusOnlyAction ? threadWithOriginalMessage : [approvalMessage, ...threadWithOriginalMessage]
      ) as unknown as Prisma.InputJsonArray;

      const updated = await tx.inquiry.update({
        where: { id },
        data: {
          ...updateData,
          reviewThread: updatedThreadFromTx,
          ...(action === "approve" && approvalStatus
            ? {
                reviewStatus: approvalStatus === "WAITLISTED" ? "Waitlisted" : "Approved",
                response: approvalMessage.text,
                respondedAt: new Date(),
                isResolved: true,
                lastUpdatedBy: "admin",
              }
            : {}),
        },
      });

      if (action === "return" && currentInquiry?.application?.id) {
        const uploadedFiles = normalizeUploadedFiles(currentInquiry.application.uploadedFiles);
        await tx.skeapApplication.update({
          where: { id: currentInquiry.application.id },
          data: {
            status: "RETURNED_FOR_EDIT",
            ...(uploadedFiles
              ? {
                  uploadedFiles: Object.fromEntries(
                    Object.entries(uploadedFiles).map(([key, upload]) => [
                      key,
                      {
                        url: upload.url,
                        ...(upload.name !== undefined ? { name: upload.name } : {}),
                        ...(upload.verified !== undefined ? { verified: upload.verified } : {}),
                      },
                    ])
                  ),
                }
              : {}),
          },
        });
        await writeAuditLog(tx, {
          action: "APPLICATION_RETURNED_FOR_EDITS",
          actorId: appUser.id,
          targetTable: "inquiries",
          targetId: id,
          beforeData: {
            reviewStatus: currentInquiry.reviewStatus,
            applicationStatus: currentInquiry.application.status,
          },
          afterData: {
            reviewStatus: "Returned",
            applicationStatus: "RETURNED_FOR_EDIT",
            corrections: text,
          },
          metadata: {
            target: currentInquiry.application.applicantName || currentInquiry.userId,
            targetId: id,
            reason: text,
          },
        });
      }

      if (action === "approve" && currentInquiry?.userId) {
        if (currentInquiry.application?.id) {
          await tx.skeapApplication.update({
            where: { id: currentInquiry.application.id },
            data: {
              status: approvalStatus,
              waitlistPosition: approvalStatus === "WAITLISTED" ? waitlistPosition : null,
            },
          });
        }

        if (approvalStatus === "APPROVED") {
        const targetUser = await tx.user.findUnique({
          where: { id: currentInquiry.userId },
          select: { id: true, role: true },
        });

        if (targetUser?.role === Role.YOUTH || targetUser?.role === Role.GRANTEE) {
          const previousRole = targetUser.role;

          await tx.user.update({
            where: { id: targetUser.id },
            data: {
              role: Role.GRANTEE,
            },
          });

          await writeAuditLog(tx, {
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

          await tx.grantee.upsert({
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
      }

      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json(
        { error: "Application capacity changed while approving. Refresh and try again to see the current outcome." },
        { status: 409 }
      );
    }
    if (message === "This application is no longer eligible to be returned for edits.") {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    if (
      message === "Waitlisted applications must be promoted from the waitlist before approval." ||
      message === "This application has already been approved."
    ) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
