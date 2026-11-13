import { NextRequest, NextResponse } from "next/server";
import {
  getSkeapRevocationReasonLabel,
  isSkeapRevocationReason,
} from "@/lib/skeap-revocation";
import { dispatchSkeapRevocationNotification } from "@/lib/skeap-revocation-notification";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";
import { downgradeInactiveGranteeRole } from "@/lib/grantee-role";
import { refreshInactiveGranteesView } from "@/lib/grantee-archive-view";
import { getSkeapCapacityCount, getSkeapMaxSlots, lockSkeapCapacity } from "@/lib/skeap-capacity";
import { reindexSkeapWaitlist } from "@/lib/skeap-waitlist";

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

  const body = await req.json().catch(() => ({}));
  const nextStatus = typeof body?.status === "string" ? body.status.trim().toUpperCase() : undefined;
  const revocationReasonValue = typeof body?.reason === "string" ? body.reason.trim() : "";
  const revocationNotes = typeof body?.additionalNotes === "string" ? body.additionalNotes.trim() : "";
  if (nextStatus === "GRADUATED") {
    return NextResponse.json(
      { error: "Use the graduation endpoint to timestamp graduation and reclaim the scholarship slot." },
      { status: 409 }
    );
  }
  if (nextStatus !== "ACTIVE" && nextStatus !== "REVOKED") {
    return NextResponse.json({ error: "Invalid grantee status" }, { status: 400 });
  }
  if (nextStatus === "REVOKED" && !isSkeapRevocationReason(revocationReasonValue)) {
    return NextResponse.json({ error: "Select a valid reason for revocation." }, { status: 400 });
  }
  const revocationReason = isSkeapRevocationReason(revocationReasonValue)
    ? getSkeapRevocationReasonLabel(revocationReasonValue)
    : "";
  if (nextStatus === "REVOKED" && revocationNotes.length > 1000) {
    return NextResponse.json({ error: "Additional notes must be 1,000 characters or fewer." }, { status: 400 });
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
          revocationNotificationStatus: true,
          user: {
            select: { id: true, email: true, fullName: true, role: true },
          },
        },
      });
      if (!current) throw new Error("GRANTEE_NOT_FOUND");
      if (current.status === "GRADUATED") throw new Error("GRANTEE_ARCHIVED");

      if (nextStatus === "REVOKED" && current.status === "REVOKED") {
        if (
          current.revocationReason !== revocationReason ||
          (current.revocationNotes ?? "") !== revocationNotes
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
            revocationNotificationStatus: current.revocationNotificationStatus,
          },
          recipient: current.user,
        };
      }
      if (nextStatus === "REVOKED" && current.status === "REMOVED") {
        throw new Error("GRANTEE_ALREADY_REVOKED");
      }

      if (
        nextStatus === "ACTIVE" &&
        current.status !== "ACTIVE" &&
        current.status !== "PROBATIONARY"
      ) {
        await lockSkeapCapacity(tx);
        const maxSlots = await getSkeapMaxSlots(tx);
        if (await getSkeapCapacityCount(tx, current.userId) >= maxSlots) {
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
        },
        metadata: {
          target: current.userId,
          targetId: id,
          status: saved.status,
          ...(nextStatus === "REVOKED"
            ? { reason: revocationReason, additionalNotes: revocationNotes || null }
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
    const errorMessage = error instanceof Error ? error.message : "";
    const errorName = error instanceof Error ? error.name : "UnknownError";
    const errorCode =
      typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
        ? error.code
        : undefined;
    console.error("SKEAP grantee status transaction failed", {
      granteeId: id,
      errorName,
      ...(errorCode ? { errorCode } : {}),
    });
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
    if (
      /column .* does not exist|invalid input value for enum "GranteeStatus"/i.test(errorMessage) ||
      (typeof error === "object" && error !== null && "code" in error && error.code === "P2022")
    ) {
      return NextResponse.json(
        {
          code: "DATABASE_MIGRATION_REQUIRED",
          error: "The SKEAP database schema is not up to date. Apply pending migrations, then try again.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      {
        code: "REVOCATION_DATABASE_FAILED",
        error: "Could not save the grantee status. Refresh the page before retrying.",
      },
      { status: 500 }
    );
  }

  if (updated.capacityFull) {
    return NextResponse.json(
      {
        error: updated.applicationWaitlisted
          ? "All 55 slots are filled; this applicant was moved to the waitlist."
          : "All 55 SKEAP scholarship slots are filled.",
      },
      { status: 409 }
    );
  }

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

      return { status: "DELETED" as const };
    });

    if (deletedGrantee.status === "NOT_FOUND") {
      return NextResponse.json({ error: "Grantee not found" }, { status: 404 });
    }
    if (deletedGrantee.status === "RETAINED") {
      return NextResponse.json({ error: "Graduated grantee records cannot be deleted during statutory retention." }, { status: 409 });
    }

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
