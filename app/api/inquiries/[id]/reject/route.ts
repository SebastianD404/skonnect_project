import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";

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

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await authorizeReviewUser();
    if (auth.error) {
      return auth.error;
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body.reason !== "string" || !body.reason.trim()) {
      return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 });
    }

    const rejectionReason = body.reason.trim();

    const inquiryRecord = await prisma.inquiry.findUnique({
      where: { id },
      select: {
        reviewThread: true,
        userId: true,
      },
    });

    if (!inquiryRecord) {
      return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
    }

    const existingThread = Array.isArray(inquiryRecord.reviewThread)
      ? inquiryRecord.reviewThread
      : [];

    const updatedThread = [
      {
        id: `admin-reject-${Date.now()}`,
        role: "admin",
        createdAt: new Date().toISOString(),
        text: `Application rejected: ${rejectionReason}`,
      },
      ...existingThread,
    ];

    const inquiry = await prisma.$transaction(async (tx) => {
      const updated = await tx.inquiry.update({
        where: { id },
        data: {
          reviewStatus: "REJECTED",
          response: rejectionReason,
          respondedAt: new Date(),
          isResolved: true,
          lastUpdatedBy: "admin",
          reviewThread: updatedThread,
        },
      });

      await writeAuditLog(tx, {
        action: "REJECT_SKEAP_APPLICATION",
        actorId: auth.user.id,
        targetTable: "inquiries",
        targetId: id,
        beforeData: {
          reviewStatus: "Pending review",
        },
        afterData: {
          reviewStatus: updated.reviewStatus,
          response: updated.response,
        },
        metadata: {
          target: inquiryRecord.userId,
          targetId: id,
          reason: rejectionReason,
        },
        meta: {
          reason: rejectionReason,
          target: inquiryRecord.userId,
          targetId: id,
        },
      });

      return updated;
    });

    // TODO: replace with actual email service integration.
    await prisma.notificationLog.create({
      data: {
        userId: inquiry.userId,
        type: "status_change",
        channel: "email",
        subject: "Your SKEAP application has been rejected",
        success: true,
      },
    });

    revalidatePath("/admin/skeap-applications");
    revalidatePath("/admin");

    return NextResponse.json({ success: true, reviewStatus: inquiry.reviewStatus, response: inquiry.response });
  } catch (error) {
    console.error("Reject application failed:", error);
    const message = error instanceof Error ? error.message : "Failed to reject application";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
