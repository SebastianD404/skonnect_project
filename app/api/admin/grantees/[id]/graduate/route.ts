import { GranteeStatus, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";
import { createGmailTransporter, sendTransactionalEmail } from "@/lib/broadcast-email";
import { getRetentionExpiryDate } from "@/lib/grantee-retention";
import { downgradeInactiveGranteeRole } from "@/lib/grantee-role";
import { refreshInactiveGranteesView } from "@/lib/grantee-archive-view";
import { refreshSkeapApplicationsAdminView } from "@/lib/application-admin-view-refresh";
import { getGranteeGraduationHolds } from "@/lib/grantee-graduation-holds";
import { GRADE_REPORT_MIME_TYPES, hasGradeReportSignature } from "@/lib/ocr/grade-report-file";
import { uploadPrivateDocument, removePrivateDocument } from "@/lib/private-documents";
import { createClient } from "@/lib/supabase/server";
import { hasGranteeColumn, hasGranteeRetentionColumn, prisma } from "@/lib/prisma";
import {
  MAX_SKEAP_UPLOAD_SIZE_BYTES,
  SKEAP_UPLOAD_TOO_LARGE_MESSAGE,
} from "@/lib/skeap-upload";

export const dynamic = "force-dynamic";

type GraduationInput = {
  schoolClearanceVerified: boolean;
  skClearanceVerified: boolean;
  remarks: string;
  file: File | null;
};

async function parseGraduationInput(request: NextRequest): Promise<GraduationInput | null> {
  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    return {
      schoolClearanceVerified: formData.get("schoolClearanceVerified") === "true",
      skClearanceVerified: formData.get("skClearanceVerified") === "true",
      remarks: String(formData.get("remarks") ?? "").trim(),
      file: file instanceof File ? file : null,
    };
  }

  try {
    const body = await request.json();
    return {
      schoolClearanceVerified: body?.schoolClearanceVerified === true,
      skClearanceVerified: body?.skClearanceVerified === true,
      remarks: typeof body?.remarks === "string" ? body.remarks.trim() : "",
      file: null,
    };
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing grantee id." }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await ensureProfile(user);
  if (!admin || (admin.role !== Role.SK_OFFICIAL && admin.role !== Role.SUPER_ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const activeProfile = await prisma.user.findUnique({
    where: { id: admin.id },
    select: { isActive: true },
  });
  if (!activeProfile?.isActive) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const holds = await getGranteeGraduationHolds(prisma, id);
    return NextResponse.json(holds, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Could not check current graduation holds:", error);
    return NextResponse.json(
      { error: "Unable to verify current graduation holds." },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await ensureProfile(user);
  if (!admin || (admin.role !== Role.SK_OFFICIAL && admin.role !== Role.SUPER_ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing grantee id." }, { status: 400 });
  }

  const input = await parseGraduationInput(request);
  if (!input) {
    return NextResponse.json({ error: "Submit the clearance checklist and optional clearance notes." }, { status: 400 });
  }
  if (input.schoolClearanceVerified !== true || input.skClearanceVerified !== true) {
    return NextResponse.json({ error: "Both school and SK Office clearance checks are required before graduation." }, { status: 400 });
  }
  if (input.remarks.length > 1000) {
    return NextResponse.json({ error: "Clearance notes must be 1,000 characters or fewer." }, { status: 400 });
  }

  let initialHolds: Awaited<ReturnType<typeof getGranteeGraduationHolds>>;
  try {
    initialHolds = await getGranteeGraduationHolds(prisma, id);
  } catch (error) {
    console.error("Could not check current graduation holds before upload:", error);
    return NextResponse.json(
      { error: "Unable to verify current graduation holds." },
      { status: 500 },
    );
  }
  if (initialHolds.pendingPayoutHold) {
    return NextResponse.json(
      { error: "Financial hold detected: resolve or confirm the unconfirmed payout before graduating." },
      { status: 400 },
    );
  }
  if (initialHolds.pendingComplianceCount > 0) {
    return NextResponse.json(
      { error: "Pending compliance submissions must be resolved before graduating." },
      { status: 400 },
    );
  }

  let clearanceFile = input.file;
  if (clearanceFile) {
    const submittedContentType = clearanceFile.type.toLowerCase();
    const isJfif = /\.jfif$/i.test(clearanceFile.name);
    const contentType = submittedContentType === "image/jfif" || isJfif
      ? "image/jpeg"
      : submittedContentType;
    if (
      !GRADE_REPORT_MIME_TYPES.has(contentType) ||
      clearanceFile.size === 0
    ) {
      return NextResponse.json({ error: "Clearance scans must be PDF, JPG/JFIF, PNG, or WEBP files." }, { status: 400 });
    }
    if (clearanceFile.size > MAX_SKEAP_UPLOAD_SIZE_BYTES) {
      return NextResponse.json({ error: SKEAP_UPLOAD_TOO_LARGE_MESSAGE }, { status: 400 });
    }
    if (contentType !== clearanceFile.type) {
      clearanceFile = new File([clearanceFile], clearanceFile.name.replace(/\.jfif$/i, ".jpg"), {
        type: contentType,
        lastModified: clearanceFile.lastModified,
      });
    }
    if (!hasGradeReportSignature(new Uint8Array(await clearanceFile.arrayBuffer()), contentType)) {
      return NextResponse.json({ error: "The uploaded clearance does not match its declared file type." }, { status: 400 });
    }
  }

  let uploadedPath: string | null = null;
  try {
    const uploaded = clearanceFile
      ? await uploadPrivateDocument(user.id, clearanceFile, "grantee-clearances", "exit-clearance")
      : null;
    uploadedPath = uploaded?.path ?? null;

    const [
      hasRetentionColumn,
      hasExitClearanceFileNameColumn,
      hasExitClearanceSubmittedAtColumn,
    ] = await Promise.all([
      hasGranteeRetentionColumn(),
      hasGranteeColumn("exitClearanceFileName"),
      hasGranteeColumn("exitClearanceSubmittedAt"),
    ]);
    const graduation = await prisma.$transaction(async (tx) => {
      const grantee = await tx.grantee.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          userId: true,
          updatedAt: true,
          graduatedAt: true,
          exitClearanceStatus: true,
          exitClearanceUrl: true,
          ...(hasExitClearanceFileNameColumn ? { exitClearanceFileName: true } : {}),
          ...(hasExitClearanceSubmittedAtColumn ? { exitClearanceSubmittedAt: true } : {}),
          graduationRemarks: true,
          user: {
            select: { fullName: true, role: true, email: true },
          },
        },
      });

      if (!grantee) throw new Error("GRANTEE_NOT_FOUND");
      const restoredRows = grantee.status === GranteeStatus.REMOVED && grantee.user.role === Role.GRANTEE
        ? await tx.$queryRaw<Array<{ restored: boolean }>>`
            SELECT EXISTS (
              SELECT 1
              FROM "audit_logs" role_change
              WHERE role_change."targetTable" = 'users'
                AND role_change."targetId" = ${grantee.userId}
                AND role_change."action" = 'UPDATE_USER_ROLE'
                AND role_change."afterData"->>'role' = 'GRANTEE'
                AND role_change."createdAt" >= ${grantee.updatedAt}
                AND NOT EXISTS (
                  SELECT 1
                  FROM "audit_logs" newer_role_change
                  WHERE newer_role_change."targetTable" = 'users'
                    AND newer_role_change."targetId" = ${grantee.userId}
                    AND newer_role_change."action" = 'UPDATE_USER_ROLE'
                    AND newer_role_change."createdAt" > role_change."createdAt"
                )
            ) AS restored
          `
        : [];
      const isRestored = restoredRows[0]?.restored === true;
      const isActive = grantee.status === GranteeStatus.ACTIVE || grantee.status === GranteeStatus.PROBATIONARY;
      const canRetainAdminRole = grantee.user.role === Role.SK_OFFICIAL || grantee.user.role === Role.SUPER_ADMIN;
      if ((!isActive && !isRestored) || (grantee.user.role !== Role.GRANTEE && !canRetainAdminRole)) {
        throw new Error("GRANTEE_NOT_ACTIVE");
      }

      const currentHolds = await getGranteeGraduationHolds(tx, grantee.id);
      if (currentHolds.pendingPayoutHold) throw new Error("GRADUATION_FINANCIAL_HOLD");
      if (currentHolds.pendingComplianceCount > 0) throw new Error("GRADUATION_COMPLIANCE_HOLD");

      const graduatedAt = new Date();
      const retentionExpiresAt = getRetentionExpiryDate({ graduatedAt })!;
      const updateResult = await tx.grantee.updateMany({
        where: {
          id,
          status: isRestored
            ? GranteeStatus.REMOVED
            : { in: [GranteeStatus.ACTIVE, GranteeStatus.PROBATIONARY] },
          user: {
            is: {
              role: { in: [Role.GRANTEE, Role.SK_OFFICIAL, Role.SUPER_ADMIN] },
            },
          },
        },
        data: {
          status: GranteeStatus.GRADUATED,
          graduatedAt,
          graduatedBy: admin.id,
          exitClearanceStatus: "CLEARED",
          exitClearanceUrl: uploaded?.path ?? grantee.exitClearanceUrl,
          ...(hasExitClearanceFileNameColumn
            ? {
                exitClearanceFileName:
                  clearanceFile?.name ??
                  ("exitClearanceFileName" in grantee ? grantee.exitClearanceFileName : null),
              }
            : {}),
          ...(hasExitClearanceSubmittedAtColumn
            ? {
                exitClearanceSubmittedAt: uploaded
                  ? graduatedAt
                  : "exitClearanceSubmittedAt" in grantee
                    ? grantee.exitClearanceSubmittedAt
                    : null,
              }
            : {}),
          schoolClearanceVerified: true,
          skClearanceVerified: true,
          graduationRemarks: [
            grantee.graduationRemarks ? `Scholar note: ${grantee.graduationRemarks}` : "",
            input.remarks ? `Clearance notes: ${input.remarks}` : "",
          ].filter(Boolean).join("\n") || null,
          ...(hasRetentionColumn ? { retentionExpiresAt } : {}),
        },
      });
      if (updateResult.count !== 1) throw new Error("GRANTEE_NOT_ACTIVE");

      await tx.notification.updateMany({
        where: {
          userId: grantee.userId,
          sourceKey: `graduation-candidate-ready:${grantee.id}`,
        },
        data: { isRead: true, readAt: graduatedAt },
      });

      await downgradeInactiveGranteeRole(tx, grantee.userId);

      const messageTitle = "Official SKEAP Graduation & Exit Clearance Notice";
      const messageBody = [
        "Congratulations on completing your SKEAP academic journey. Your exit clearance has been verified and your graduation has been recorded.",
        "Your account has transitioned back to KK Youth portal access. Your KK Profile remains available.",
        "Thank you for your dedication and for being part of SKEAP.",
      ].join("\n\n");
      const sourceKey = `graduation-exit-clearance:${grantee.id}`;
      const scholarMessage = await tx.granteeMessage.create({
        data: {
          userId: grantee.userId,
          senderId: admin.id,
          subject: messageTitle,
          body: messageBody,
        },
        select: { id: true },
      });
      await tx.notification.upsert({
        where: {
          userId_sourceKey: {
            userId: grantee.userId,
            sourceKey,
          },
        },
        create: {
          userId: grantee.userId,
          sourceKey,
          message: `${messageTitle}\n${messageBody}`,
        },
        update: {
          message: `${messageTitle}\n${messageBody}`,
          isRead: false,
          readAt: null,
        },
      });
      await tx.adminNotification.create({
        data: {
          title: "Scholarship Slot Freed",
          message: `${grantee.user.fullName} has graduated after exit clearance verification. 1 slot is available for administrator waitlist review.`,
          type: "SLOT_RECLAIMED",
        },
      });
      await writeAuditLog(tx, {
        action: "SCHOLAR_GRADUATED",
        actorId: admin.id,
        targetTable: "grantees",
        targetId: grantee.id,
        beforeData: {
          status: grantee.status,
          role: grantee.user.role,
          exitClearanceStatus: grantee.exitClearanceStatus,
          exitClearanceUrl: grantee.exitClearanceUrl,
          exitClearanceFileName:
            "exitClearanceFileName" in grantee ? grantee.exitClearanceFileName : null,
          exitClearanceSubmittedAt:
            "exitClearanceSubmittedAt" in grantee
              ? grantee.exitClearanceSubmittedAt?.toISOString() ?? null
              : null,
        },
        afterData: {
          status: GranteeStatus.GRADUATED,
          exitClearanceStatus: "CLEARED",
          exitClearanceUrl: uploaded?.path ?? grantee.exitClearanceUrl,
          exitClearanceFileName:
            clearanceFile?.name ??
            ("exitClearanceFileName" in grantee ? grantee.exitClearanceFileName : null),
          exitClearanceSubmittedAt: uploaded
            ? graduatedAt.toISOString()
            : "exitClearanceSubmittedAt" in grantee
              ? grantee.exitClearanceSubmittedAt?.toISOString() ?? null
              : null,
          graduatedAt: graduatedAt.toISOString(),
          graduatedBy: admin.id,
          role: grantee.user.role === Role.GRANTEE ? Role.YOUTH : grantee.user.role,
          schoolClearanceVerified: true,
          skClearanceVerified: true,
          graduationRemarks: [
            grantee.graduationRemarks ? `Scholar note: ${grantee.graduationRemarks}` : "",
            input.remarks ? `Clearance notes: ${input.remarks}` : "",
          ].filter(Boolean).join("\n") || null,
        },
        metadata: {
          granteeName: grantee.user.fullName,
          messageId: scholarMessage.id,
          clearanceRemarks: input.remarks || null,
        },
      });

      return {
        id: grantee.id,
        userId: grantee.userId,
        email: grantee.user.email,
        fullName: grantee.user.fullName,
        status: GranteeStatus.GRADUATED,
        exitClearanceStatus: "CLEARED",
        graduatedAt,
        graduatedBy: admin.id,
        retentionExpiresAt,
      };
    });

    const noticeTitle = "SKEAP Exit Clearance Verified - Graduation Confirmed";
    const noticeBody = [
      `Dear ${graduation.fullName || "SKEAP Scholar"},`,
      "",
      "Congratulations! The SK Council of Barangay Pico has verified your Exit Clearance.",
      "Your SKEAP grant is complete, and your graduation has been recorded.",
      "Your account has transitioned back to KK Youth portal access. Your KK Profile remains available.",
      "",
      "Thank you for your dedication and for being part of SKEAP.",
      "SK Council of Barangay Pico",
    ].join("\n");
    let emailSent = false;
    if (graduation.email?.trim() && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      try {
        await sendTransactionalEmail(
          createGmailTransporter(),
          graduation.email,
          noticeTitle,
          noticeBody,
          `scholar-graduated-${graduation.id}`,
        );
        emailSent = true;
      } catch (emailError) {
        console.error("Could not send SKEAP graduation notice:", {
          granteeId: graduation.id,
          userId: graduation.userId,
          error: emailError,
        });
      }
    } else {
      console.error("SKEAP graduation notice email was not sent because recipient or email configuration is missing.", {
        granteeId: graduation.id,
        userId: graduation.userId,
      });
    }
    try {
      await prisma.notificationLog.create({
        data: {
          userId: graduation.userId,
          type: "SCHOLAR_GRADUATED",
          channel: "email",
          subject: noticeTitle,
          success: emailSent,
        },
      });
    } catch (notificationLogError) {
      console.error("Could not record SKEAP graduation email delivery status:", notificationLogError);
    }

    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/admin/grantees");
    revalidatePath("/admin/exit-clearances");
    revalidatePath("/admin/grantees/records");
    revalidatePath("/admin/skeap-waitlist");
    revalidatePath("/programs/skeap");

    try {
      await Promise.all([
        refreshInactiveGranteesView(),
        refreshSkeapApplicationsAdminView(),
      ]);
    } catch (refreshError) {
      console.error("Grantee was graduated, but an admin materialized view could not be refreshed:", refreshError);
      return NextResponse.json(
        { error: "Exit clearance was verified and graduation was recorded, but an admin report could not be refreshed." },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      emailSent,
      grantee: {
        id: graduation.id,
        status: graduation.status,
        exitClearanceStatus: graduation.exitClearanceStatus,
        graduatedAt: graduation.graduatedAt,
        graduatedBy: graduation.graduatedBy,
        retentionExpiresAt: graduation.retentionExpiresAt,
      },
    });
  } catch (error) {
    if (uploadedPath) {
      try {
        await removePrivateDocument(uploadedPath);
      } catch (cleanupError) {
        console.error("Could not remove an uncommitted exit-clearance upload:", cleanupError);
      }
    }
    const message = error instanceof Error ? error.message : "Unable to graduate grantee.";
    if (message === "GRANTEE_NOT_FOUND") {
      return NextResponse.json({ error: "Grantee not found." }, { status: 404 });
    }
    if (message === "GRANTEE_NOT_ACTIVE") {
      return NextResponse.json({ error: "Only active grantees can be marked as graduated." }, { status: 409 });
    }
    if (message === "GRADUATION_FINANCIAL_HOLD") {
      return NextResponse.json(
        { error: "Financial hold detected: resolve or confirm the unconfirmed payout before graduating." },
        { status: 400 },
      );
    }
    if (message === "GRADUATION_COMPLIANCE_HOLD") {
      return NextResponse.json(
        { error: "Pending compliance submissions must be resolved before graduating." },
        { status: 400 },
      );
    }
    console.error("Failed to graduate grantee after exit clearance verification:", error);
    return NextResponse.json({ error: "Failed to verify clearance and graduate scholar." }, { status: 500 });
  }
}
