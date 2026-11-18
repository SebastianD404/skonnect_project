import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  getSkeapRevocationReasonLabel,
  isSkeapRevocationReason,
  isSkeapRevocationProofType,
} from "@/lib/skeap-revocation";
import { dispatchSkeapRevocationNotification } from "@/lib/skeap-revocation-notification";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";
import { downgradeInactiveGranteeRole } from "@/lib/grantee-role";
import { refreshInactiveGranteesView } from "@/lib/grantee-archive-view";
import { refreshSkeapApplicationsAdminView } from "@/lib/application-admin-view-refresh";
import { getSkeapCapacitySnapshot, lockSkeapCapacity } from "@/lib/skeap-capacity";
import { reindexSkeapWaitlist } from "@/lib/skeap-waitlist";
import {
  InvalidSkeapRevocationProofError,
  removeSkeapRevocationProof,
  storeSkeapRevocationProof,
} from "@/lib/skeap-revocation-proof";
import {
  buildIdentityFingerprint,
  parseSkeapApplicantName,
} from "@/lib/skeap-application-guard";

async function authorizeUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const appUser = await ensureProfile(user);
  if (!appUser) {
    return { error: NextResponse.json({ error: "User not found" }, { status: 404 }) };
  }

  if (appUser.role !== "SK_OFFICIAL" && appUser.role !== "SUPER_ADMIN") {
    return {
      error: NextResponse.json(
        { error: "Only SK officials can update grantee status" },
        { status: 403 }
      ),
    };
  }

  return { user: appUser };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing grantee id" }, { status: 400 });
  }

  const auth = await authorizeUser();
  if (auth.error) return auth.error;

  let body: Record<string, unknown> = {};
  let proofFile: File | null = null;
  let proofType = "";
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "Invalid revocation form submission." }, { status: 400 });
    }
    const formFile = formData.get("proofFile");
    proofFile = formFile instanceof File ? formFile : null;
    proofType = String(formData.get("proofType") ?? "");
    body = {
      status: formData.get("status"),
      reason: formData.get("reason"),
      additionalNotes: formData.get("additionalNotes"),
      isPermanentlyDisqualified: formData.get("isPermanentlyDisqualified") === "true",
    };
  } else {
    let parsedBody: unknown;
    try {
      parsedBody = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid revocation request." }, { status: 400 });
    }
    body = parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody)
      ? parsedBody as Record<string, unknown>
      : {};
    proofType = typeof body.proofType === "string" ? body.proofType : "";
  }
  const nextStatus = typeof body?.status === "string" ? body.status.trim().toUpperCase() : undefined;
  const revocationReasonValue = typeof body?.reason === "string" ? body.reason.trim() : "";
  const revocationNotes = typeof body?.additionalNotes === "string" ? body.additionalNotes.trim() : "";
  proofType = proofType.trim();
  if (proofType.startsWith("Other:")) {
    proofType = `Other: ${proofType.slice("Other:".length).trim()}`;
  }
  if (
    nextStatus === "REVOKED" &&
    body?.isPermanentlyDisqualified !== undefined &&
    typeof body.isPermanentlyDisqualified !== "boolean"
  ) {
    return NextResponse.json({ error: "Permanent disqualification must be a boolean value." }, { status: 400 });
  }
  const isPermanentlyDisqualified = body?.isPermanentlyDisqualified === true;
  if (nextStatus === "GRADUATED") {
    return NextResponse.json(
      { error: "Use the graduation endpoint to timestamp graduation and reclaim the scholarship slot." },
      { status: 409 }
    );
  }
  if (nextStatus !== "ACTIVE" && nextStatus !== "REVOKED") {
    return NextResponse.json({ error: "Invalid grantee status" }, { status: 400 });
  }
  if (
    nextStatus === "REVOKED" &&
    (revocationReasonValue.length < 5 || !isSkeapRevocationReason(revocationReasonValue))
  ) {
    return NextResponse.json({ error: "Select a valid reason for revocation." }, { status: 400 });
  }
  const revocationReason = isSkeapRevocationReason(revocationReasonValue)
    ? getSkeapRevocationReasonLabel(revocationReasonValue)
    : "";
  if (nextStatus === "REVOKED" && revocationNotes.length > 1000) {
    return NextResponse.json({ error: "Additional notes must be 1,000 characters or fewer." }, { status: 400 });
  }
  if (nextStatus === "REVOKED" && revocationReasonValue === "UNBECOMING_ACTS") {
    if (!revocationNotes) {
      return NextResponse.json({ error: "Incident summary and case details are required." }, { status: 400 });
    }
    if (!isSkeapRevocationProofType(proofType)) {
      return NextResponse.json(
        { error: "Select a valid supporting proof document type. Other document types must be specified with at least 3 characters." },
        { status: 400 },
      );
    }
    if (!proofFile) {
      return NextResponse.json({ error: "A valid supporting proof document is required." }, { status: 400 });
    }
  }

  let revocationProof: Awaited<ReturnType<typeof storeSkeapRevocationProof>> | null = null;
  if (
    nextStatus === "REVOKED" &&
    revocationReasonValue === "UNBECOMING_ACTS" &&
    proofFile
  ) {
    try {
      const current = await prisma.grantee.findUnique({
        where: { id },
        select: { id: true, status: true },
      });
      if (!current) return NextResponse.json({ error: "Grantee not found" }, { status: 404 });
      if (current.status === "GRADUATED") {
        return NextResponse.json(
          { error: "Graduated grantee records are locked for statutory retention." },
          { status: 409 },
        );
      }
      if (current.status === "REMOVED") {
        return NextResponse.json({ error: "This grantee has already been removed." }, { status: 409 });
      }
      revocationProof = await storeSkeapRevocationProof(proofFile, id, proofType);
    } catch (error) {
      if (error instanceof InvalidSkeapRevocationProofError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      console.error("[PATCH /api/admin/grantees/[id]] Error:", error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to revoke grantee." },
        { status: 500 },
      );
    }
  }

  const revocationRemarks = revocationNotes
    ? `${revocationReason}\nAdditional Notes: ${revocationNotes}`
    : revocationReason;
  let updated:
    | {
        capacityFull: true;
        applicationWaitlisted: boolean;
      }
    | {
        capacityFull: false;
        grantee: {
          id: string;
          userId: string;
          status: string;
          graduatedAt: Date | null;
          dateRemoved: Date | null;
          revocationReason: string | null;
          revocationNotes: string | null;
          isPermanentlyDisqualified: boolean;
          revocationNotificationStatus: "NOT_REQUIRED" | "PENDING" | "SENDING" | "FAILED" | "SENT";
        };
        recipient: { id: string; email: string; fullName: string; role: string };
      };

  try {
    updated = await prisma.$transaction(async (tx) => {
      const current = await tx.grantee.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          status: true,
          graduatedAt: true,
          dateRemoved: true,
          revocationReason: true,
          revocationNotes: true,
          isPermanentlyDisqualified: true,
          revocationNotificationStatus: true,
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              role: true,
              kkProfileId: true,
              kkProfile: {
                select: {
                  firstName: true,
                  middleName: true,
                  lastName: true,
                  birthDate: true,
                },
              },
              skeapApplications: {
                orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
                take: 1,
                select: { applicantName: true, dateOfBirth: true },
              },
            },
          },
        },
      });
      if (!current) throw new Error("GRANTEE_NOT_FOUND");
      if (current.status === "GRADUATED") throw new Error("GRANTEE_ARCHIVED");

      if (nextStatus === "REVOKED" && current.status === "REVOKED") {
        if (
          current.revocationReason !== revocationReason ||
          (current.revocationNotes ?? "") !== revocationNotes ||
          current.isPermanentlyDisqualified !== isPermanentlyDisqualified
        ) {
          throw new Error("GRANTEE_ALREADY_REVOKED");
        }
        return {
          capacityFull: false as const,
          grantee: {
            id: current.id,
            userId: current.userId,
            status: current.status,
            graduatedAt: current.graduatedAt,
            dateRemoved: current.dateRemoved,
            revocationReason: current.revocationReason,
            revocationNotes: current.revocationNotes,
            isPermanentlyDisqualified: current.isPermanentlyDisqualified,
            revocationNotificationStatus: current.revocationNotificationStatus,
          },
          recipient: current.user,
        };
      }
      if (nextStatus === "REVOKED" && current.status === "REMOVED") {
        throw new Error("GRANTEE_ALREADY_REVOKED");
      }

      const latestApplication = current.user.skeapApplications?.[0];
      const applicationName = parseSkeapApplicantName(latestApplication?.applicantName);
      const profileName = parseSkeapApplicantName(current.user.fullName);
      const identityFingerprint = buildIdentityFingerprint({
        firstName:
          current.user.kkProfile?.firstName ??
          applicationName?.firstName ??
          profileName?.firstName,
        middleName:
          current.user.kkProfile?.middleName ??
          applicationName?.middleName ??
          profileName?.middleName,
        lastName:
          current.user.kkProfile?.lastName ??
          applicationName?.lastName ??
          profileName?.lastName,
        dateOfBirth:
          current.user.kkProfile?.birthDate ??
          latestApplication?.dateOfBirth,
      })?.exact ?? null;

      if (
        nextStatus === "ACTIVE" &&
        current.status !== "ACTIVE" &&
        current.status !== "PROBATIONARY"
      ) {
        await lockSkeapCapacity(tx);
        const capacity = await getSkeapCapacitySnapshot(tx, current.userId);
        if (capacity.isFull) {
          const applicationsToWaitlist = await tx.skeapApplication.findMany({
            where: { userId: current.userId, status: { in: ["APPROVED", "PENDING"] } },
            orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
            select: { id: true, status: true },
          });
          let waitlistPosition =
            (await tx.skeapApplication.count({ where: { status: "WAITLISTED" } })) + 1;
          for (const application of applicationsToWaitlist) {
            await tx.skeapApplication.update({
              where: { id: application.id },
              data: { status: "WAITLISTED", waitlistPosition },
            });
            waitlistPosition += 1;
            await writeAuditLog(tx, {
              action: "APPLICATION_ADDED_TO_WAITLIST",
              actorId: auth.user.id,
              targetTable: "skeap_applications",
              targetId: application.id,
              beforeData: { status: application.status },
              afterData: { status: "WAITLISTED" },
              metadata: { target: current.userId, reason: "Scholarship capacity limit reached" },
            });
          }
          if (applicationsToWaitlist.length > 0) {
            await tx.user.update({
              where: { id: current.userId },
              data: { role: "YOUTH" },
            });
            await reindexSkeapWaitlist(tx);
          }
          return { capacityFull: true as const, applicationWaitlisted: applicationsToWaitlist.length > 0 };
        }
      }

      const updateResult = await tx.grantee.updateMany({
        where: { id, status: current.status },
        data: {
          status: nextStatus,
          ...(nextStatus === "ACTIVE"
            ? {
                graduatedAt: null,
                dateRemoved: null,
                revocationNotificationStatus: "NOT_REQUIRED",
                revocationNotificationAttempts: 0,
                revocationNotificationError: null,
                revocationNotificationSentAt: null,
              }
            : {
                dateRemoved: new Date(),
                revocationReason,
                revocationNotes: revocationNotes || null,
                revocationProofPath: revocationProof?.path ?? null,
                revocationProofFileName: revocationProof?.fileName ?? null,
                revocationProofType: revocationProof?.proofType ?? null,
                revocationProofHash: revocationProof?.hash ?? null,
                revocationProofMimeType: revocationProof?.mimeType ?? null,
                isPermanentlyDisqualified,
                identityFingerprint,
                remarks: revocationRemarks,
                revocationNotificationStatus: "PENDING",
                revocationNotificationAttempts: 0,
                revocationNotificationError: null,
                revocationNotificationSentAt: null,
              }),
        },
      });
      if (updateResult.count !== 1) throw new Error("GRANTEE_ARCHIVED");

      const saved = await tx.grantee.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          status: true,
          graduatedAt: true,
          dateRemoved: true,
          revocationReason: true,
          revocationNotes: true,
          revocationProofPath: true,
          revocationProofFileName: true,
          revocationProofType: true,
          revocationProofHash: true,
          revocationProofMimeType: true,
          isPermanentlyDisqualified: true,
          revocationNotificationStatus: true,
        },
      });
      if (!saved) throw new Error("GRANTEE_NOT_FOUND");

      if (saved.status === "REVOKED") {
        await downgradeInactiveGranteeRole(tx, saved.userId);
      }

      await writeAuditLog(tx, {
        action: "GRANTEE_STATUS_CHANGED",
        actorId: auth.user.id,
        targetTable: "grantees",
        targetId: id,
        beforeData: { status: current.status },
        afterData: {
          status: saved.status,
          dateRemoved: saved.dateRemoved,
          revocationReason: saved.revocationReason,
          revocationNotes: saved.revocationNotes,
          revocationProofPath: saved.revocationProofPath,
          revocationProofFileName: saved.revocationProofFileName,
          revocationProofType: saved.revocationProofType,
          revocationProofHash: saved.revocationProofHash,
          revocationProofMimeType: saved.revocationProofMimeType,
          isPermanentlyDisqualified: saved.isPermanentlyDisqualified,
        },
        metadata: {
          target: current.userId,
          targetId: id,
          status: saved.status,
          ...(nextStatus === "REVOKED"
            ? {
                reason: revocationReason,
                additionalNotes: revocationNotes || null,
                revocationProofType: saved.revocationProofType,
                revocationProofFileName: saved.revocationProofFileName,
                revocationProofHash: saved.revocationProofHash,
              }
            : {}),
        },
      });

      return {
        capacityFull: false as const,
        grantee: saved,
        recipient: current.user,
      };
    });
  } catch (error) {
    console.error("[PATCH /api/admin/grantees/[id]] Error:", error);
    if (revocationProof) {
      try {
        await removeSkeapRevocationProof(revocationProof.path);
      } catch (cleanupError) {
        console.error("[PATCH /api/admin/grantees/[id]] Proof cleanup failed:", cleanupError);
      }
    }
    const errorMessage = error instanceof Error ? error.message : "";
    if (errorMessage === "GRANTEE_NOT_FOUND") {
      return NextResponse.json({ error: "Grantee not found" }, { status: 404 });
    }
    if (errorMessage === "GRANTEE_ARCHIVED") {
      return NextResponse.json(
        { error: "Graduated grantee records are locked for statutory retention." },
        { status: 409 }
      );
    }
    if (errorMessage === "GRANTEE_ALREADY_REVOKED") {
      return NextResponse.json(
        { error: "This grantee was already revoked with a different reason. Refresh before continuing." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to revoke grantee." },
      { status: 500 },
    );
  }

  if (updated.capacityFull) {
    if (updated.applicationWaitlisted) {
      await refreshSkeapApplicationsAdminView();
    }
    return NextResponse.json(
      {
        error: updated.applicationWaitlisted
          ? "All 55 slots are filled; this applicant was moved to the waitlist."
          : "All 55 SKEAP scholarship slots are filled.",
      },
      { status: 409 }
    );
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/grantees");
  revalidatePath("/admin/skeap-waitlist");
  revalidatePath("/programs/skeap");

  let notificationStatus = updated.grantee.revocationNotificationStatus;
  let notificationErrorCode:
    | "EMAIL_CONFIGURATION_MISSING"
    | "EMAIL_DELIVERY_FAILED"
    | "NOTIFICATION_STATUS_UNAVAILABLE"
    | undefined;
  if (updated.grantee.status === "REVOKED") {
    try {
      const notification = await dispatchSkeapRevocationNotification({
        granteeId: updated.grantee.id,
        recipient: updated.recipient,
        reason: updated.grantee.revocationReason ?? revocationReason,
        additionalNotes: updated.grantee.revocationNotes,
        isPermanentlyDisqualified: updated.grantee.isPermanentlyDisqualified,
      });
      notificationStatus = notification.status;
      notificationErrorCode = notification.errorCode;
    } catch (error) {
      console.error("SKEAP revocation notification status could not be confirmed", {
        granteeId: id,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      notificationStatus = "SENDING";
      notificationErrorCode = "NOTIFICATION_STATUS_UNAVAILABLE";
    }
  }

  let archiveRefreshStatus: "REFRESHED" | "FAILED" = "REFRESHED";
  try {
    await refreshInactiveGranteesView();
  } catch (error) {
    archiveRefreshStatus = "FAILED";
    console.error("SKEAP grantee status saved but archive view refresh failed", {
      granteeId: id,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }

  const errors: string[] = [];
  if (notificationStatus === "FAILED") {
    errors.push(
      notificationErrorCode === "EMAIL_CONFIGURATION_MISSING"
        ? "The revocation was saved, but email is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD, then retry the notification."
        : "The revocation was saved, but the notification email could not be sent. Retry the notification."
    );
  } else if (notificationStatus === "SENDING" || notificationStatus === "PENDING") {
    errors.push("The revocation was saved, but the notification status could not be confirmed. Retry shortly.");
  }
  if (archiveRefreshStatus === "FAILED") {
    errors.push("The revocation was saved, but the archive report could not be refreshed. Retry to refresh it.");
  }
  const responseBody = {
    success: errors.length === 0,
    revocationStatus: updated.grantee.status,
    notificationStatus,
    notificationErrorCode,
    archiveRefreshStatus,
    grantee: {
      id: updated.grantee.id,
      userId: updated.grantee.userId,
      status: updated.grantee.status,
      graduatedAt: updated.grantee.graduatedAt,
      dateRemoved: updated.grantee.dateRemoved,
      revocationReason: updated.grantee.revocationReason,
      revocationNotes: updated.grantee.revocationNotes,
      isPermanentlyDisqualified: updated.grantee.isPermanentlyDisqualified,
      revocationNotificationStatus: notificationStatus,
    },
    ...(errors.length > 0 ? { error: errors.join(" ") } : {}),
  };
  const responseStatus =
    notificationStatus === "FAILED"
      ? 502
      : notificationStatus === "PENDING" || notificationStatus === "SENDING"
        ? 202
        : archiveRefreshStatus === "FAILED"
          ? 503
        : 200;
  return NextResponse.json(responseBody, { status: responseStatus });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing grantee id" }, { status: 400 });
    }

    const auth = await authorizeUser();
    if (auth.error) {
      return auth.error;
    }

    const rawForwardedFor = req.headers.get("x-forwarded-for") || "";
    const ipAddress = rawForwardedFor.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";
    const deletedGrantee = await prisma.$transaction(async (tx) => {
      const current = await tx.grantee.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          status: true,
          school: true,
          yearLevel: true,
          dateEnrolled: true,
          dateRemoved: true,
          graduatedAt: true,
          user: {
            select: {
              fullName: true,
              email: true,
            },
          },
        },
      });

      if (!current) return { status: "NOT_FOUND" as const };
      if (current.status === "GRADUATED") return { status: "RETAINED" as const };

      const deleteResult = await tx.grantee.deleteMany({
        where: { id, status: { not: "GRADUATED" } },
      });
      if (deleteResult.count !== 1) return { status: "RETAINED" as const };

      await writeAuditLog(tx, {
        action: "DELETE_GRANTEE_RECORD",
        actorId: auth.user.id,
        targetTable: "grantees",
        targetId: current.id,
        beforeData: {
          status: current.status,
          userId: current.userId,
          fullName: current.user.fullName,
          email: current.user.email,
          school: current.school,
          yearLevel: current.yearLevel,
          dateEnrolled: current.dateEnrolled.toISOString(),
          dateRemoved: current.dateRemoved?.toISOString() ?? null,
          graduatedAt: current.graduatedAt?.toISOString() ?? null,
        },
        metadata: {
          target: current.user.fullName,
          targetEmail: current.user.email,
          targetId: current.id,
          previousStatus: current.status,
          ipAddress,
          userAgent,
        },
      });

      return {
        status: "DELETED" as const,
      };
    });

    if (deletedGrantee.status === "NOT_FOUND") {
      return NextResponse.json({ error: "Grantee not found" }, { status: 404 });
    }
    if (deletedGrantee.status === "RETAINED") {
      return NextResponse.json({ error: "Graduated grantee records cannot be deleted during statutory retention." }, { status: 409 });
    }

    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/admin/grantees");
    revalidatePath("/admin/skeap-waitlist");
    revalidatePath("/programs/skeap");

    try {
      await refreshInactiveGranteesView();
    } catch (error) {
      console.error("Grantee was deleted, but the archive view could not be refreshed:", error);
      return NextResponse.json(
        { error: "Grantee record was deleted, but the archive report could not be refreshed." },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to delete grantee:", errorMessage, error);
    return NextResponse.json(
      { error: "Failed to delete grantee", details: errorMessage },
      { status: 500 }
    );
  }
}
