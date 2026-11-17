import { Role, SubmissionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";
import { getAcademicYearDateRange } from "@/lib/semester";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getSkeapCapacitySnapshot, lockSkeapCapacity } from "@/lib/skeap-capacity";
import { refreshSkeapApplicationsAdminView } from "@/lib/application-admin-view-refresh";
import {
  getSkeapWaitlistCycle,
  getSkeapWaitlistCycleState,
} from "@/lib/skeap-waitlist-cycle";
import { reindexSkeapWaitlist } from "@/lib/skeap-waitlist";
import {
  getWaitlistOfferExpiresAt,
  sendWaitlistSlotOfferEmail,
} from "@/lib/skeap-waitlist-offers";
import { DEFAULT_SKEAP_WAITLIST_OFFER_DAYS } from "@/lib/skeap-capacity-constants";

async function authorizeAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const appUser = await ensureProfile(user);
  if (!appUser || (appUser.role !== Role.SK_OFFICIAL && appUser.role !== Role.SUPER_ADMIN)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user: appUser };
}

function isIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Application id is required." }, { status: 400 });

  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "A valid offer deadline and message are required." }, { status: 400 });
  }
  const payload = body as Record<string, unknown>;
  const requestedDeadline = payload.deadline;
  if (requestedDeadline !== undefined && !isIsoTimestamp(requestedDeadline)) {
    return NextResponse.json({ error: "Compliance deadline must be an ISO timestamp." }, { status: 400 });
  }
  if (typeof payload.message !== "string" || !payload.message.trim() || payload.message.length > 5000) {
    return NextResponse.json({ error: "Notification message must contain 1 to 5,000 characters." }, { status: 400 });
  }
  const now = new Date();
  const deadline = typeof requestedDeadline === "string"
    ? new Date(requestedDeadline)
    : getWaitlistOfferExpiresAt(now, DEFAULT_SKEAP_WAITLIST_OFFER_DAYS);
  const message = payload.message.trim();
  if (deadline.getTime() <= now.getTime()) {
    return NextResponse.json({ error: "Compliance deadline must be in the future." }, { status: 400 });
  }

  try {
    const offer = await prisma.$transaction(async (tx) => {
      await lockSkeapCapacity(tx);
      const cycle = getSkeapWaitlistCycle();
      const cycleRange = getAcademicYearDateRange(cycle);
      if (!cycleRange) throw new Error("SKEAP_CYCLE_UNAVAILABLE");
      const cycleState = await getSkeapWaitlistCycleState(cycle, tx);
      if (cycleState.isClosed) throw new Error("CYCLE_CLOSED");

      await reindexSkeapWaitlist(tx, cycle);
      const application = await tx.skeapApplication.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          submittedAt: true,
          applicantName: true,
          emailAddress: true,
          userId: true,
          waitlistOfferStatus: true,
          waitlistOfferedAt: true,
          waitlistOfferExpiresAt: true,
          waitlistPosition: true,
          user: { select: { fullName: true, email: true } },
        },
      });
      if (!application) throw new Error("NOT_FOUND");
      if (application.status !== SubmissionStatus.WAITLISTED) throw new Error("NOT_WAITLISTED");
      if (application.submittedAt < cycleRange.start || application.submittedAt >= cycleRange.end) {
        throw new Error("STALE_CYCLE");
      }

      const hasExistingOffer =
        (application.waitlistOfferStatus === "OFFERED" ||
          application.waitlistOfferStatus === "EXPIRED") &&
        application.waitlistOfferExpiresAt !== null;
      const currentOfferNotifications = hasExistingOffer && application.waitlistOfferExpiresAt
        ? await tx.notification.findMany({
            where: {
              userId: application.userId,
              sourceKey: `skeap-waitlist-offer:${application.id}:${application.waitlistOfferExpiresAt.toISOString()}`,
            },
            select: { message: true },
            take: 1,
          })
        : [];
      const hasManualNotice = currentOfferNotifications.some(
        (notification) => typeof notification.message === "string" && notification.message.trim().length > 0,
      );
      if (!hasManualNotice) {
        const [capacity, activeOffers] = await Promise.all([
          getSkeapCapacitySnapshot(tx),
          tx.skeapApplication.findMany({
            where: {
              status: SubmissionStatus.WAITLISTED,
              waitlistOfferStatus: { in: ["OFFERED", "EXPIRED"] },
              waitlistOfferExpiresAt: { not: null },
              submittedAt: { gte: cycleRange.start, lt: cycleRange.end },
            },
            select: { id: true, userId: true, waitlistOfferExpiresAt: true },
          }),
        ]);
        const activeOfferNotifications = activeOffers.length > 0
          ? await tx.notification.findMany({
              where: {
                OR: activeOffers.flatMap((activeOffer) => activeOffer.waitlistOfferExpiresAt
                  ? [{
                      userId: activeOffer.userId,
                      sourceKey: `skeap-waitlist-offer:${activeOffer.id}:${activeOffer.waitlistOfferExpiresAt.toISOString()}`,
                    }]
                  : []),
              },
              select: { userId: true, sourceKey: true, message: true },
            })
          : [];
        const activeManualOfferCount = activeOfferNotifications.filter(
          (notification) => typeof notification.message === "string" && notification.message.trim().length > 0,
        ).length;
        if (cycleState.isClosed || capacity.availableSlots - activeManualOfferCount <= 0) {
          throw new Error("NO_OPEN_SLOTS");
        }
      }

      await tx.skeapApplication.update({
        where: { id: application.id },
        data: {
          waitlistOfferStatus: "OFFERED",
          waitlistOfferedAt: now,
          waitlistOfferExpiresAt: deadline,
          waitlistOfferReminderSentAt: null,
        },
      });

      const sourceKey = `skeap-waitlist-offer:${application.id}:${deadline.toISOString()}`;
      await tx.notification.upsert({
        where: { userId_sourceKey: { userId: application.userId, sourceKey } },
        create: {
          userId: application.userId,
          sourceKey,
          message,
        },
        update: { message, isRead: false, readAt: null },
      });

      await writeAuditLog(tx, {
        action: "SKEAP_WAITLIST_SLOT_OFFERED",
        actorId: auth.user.id,
        targetTable: "skeap_applications",
        targetId: application.id,
        beforeData: {
          waitlistOfferStatus: application.waitlistOfferStatus,
          waitlistOfferExpiresAt: application.waitlistOfferExpiresAt,
        },
        afterData: {
          waitlistOfferStatus: "OFFERED",
          waitlistOfferedAt: now,
          waitlistOfferExpiresAt: deadline,
          message,
        },
        metadata: {
          applicantName: application.applicantName || application.user.fullName,
          queuePosition: application.waitlistPosition,
        },
      });

      return {
        id: application.id,
        applicantName: application.applicantName || application.user.fullName || "Applicant",
        email: application.emailAddress || application.user.email,
        queuePosition: application.waitlistPosition,
        waitlistOfferStatus: "OFFERED" as const,
        waitlistOfferedAt: now.toISOString(),
        waitlistOfferExpiresAt: deadline.toISOString(),
        waitlistOfferMessage: message,
      };
    });

    let emailSent = false;
    let emailSkipped = false;
    let emailError: string | null = null;
    if (offer.email) {
      try {
        await sendWaitlistSlotOfferEmail({
          applicationId: offer.id,
          email: offer.email,
          message,
          sentAt: now,
          queuePosition: offer.queuePosition,
          deadline,
        });
        emailSent = true;
      } catch (error) {
        emailError = error instanceof Error ? error.message : "Unknown email delivery error";
        console.error("SKEAP waitlist offer was saved, but the email could not be sent:", {
          applicationId: offer.id,
          error: emailError,
        });
      }
    } else {
      emailSkipped = true;
    }

    let viewRefreshError: string | null = null;
    try {
      await refreshSkeapApplicationsAdminView();
    } catch (error) {
      viewRefreshError = "Offer was saved, but the admin waitlist view could not be refreshed.";
      console.error(viewRefreshError, error);
    }

    return NextResponse.json({
      success: true,
      application: offer,
      deadline: deadline.toISOString(),
      emailSent,
      emailSkipped,
      ...(emailError ? { emailError: "Offer was saved and an in-app notification was recorded, but email delivery failed." } : {}),
      ...(viewRefreshError ? { viewRefreshError } : {}),
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    if (code === "NOT_FOUND") return NextResponse.json({ error: "Application not found." }, { status: 404 });
    if (code === "NOT_WAITLISTED") return NextResponse.json({ error: "Application is not currently waitlisted." }, { status: 409 });
    if (code === "NO_OPEN_SLOTS") return NextResponse.json({ error: "No open SKEAP slots are available to offer." }, { status: 409 });
    if (code === "CYCLE_CLOSED") return NextResponse.json({ error: "The active SKEAP waitlist cycle is closed." }, { status: 409 });
    if (code === "STALE_CYCLE") return NextResponse.json({ error: "Application is not part of the active SKEAP waitlist cycle." }, { status: 409 });
    console.error("Failed to offer SKEAP waitlist slot:", error);
    return NextResponse.json({ error: "Unable to offer a SKEAP slot." }, { status: 500 });
  }
}
