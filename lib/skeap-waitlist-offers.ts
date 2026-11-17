import { ReminderType, type Prisma } from "@prisma/client";
import { createGmailTransporter, sendTransactionalEmail } from "@/lib/broadcast-email";
import { getAcademicYearDateRange } from "@/lib/semester";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_SKEAP_WAITLIST_OFFER_DAYS,
  MAX_SKEAP_WAITLIST_OFFER_DAYS,
  SKEAP_WAITLIST_OFFER_DAYS_KEY,
} from "@/lib/skeap-capacity-constants";
import {
  getSkeapCapacityCount,
  getSkeapMaxSlots,
  lockSkeapCapacity,
} from "@/lib/skeap-capacity";
import { reindexSkeapWaitlist } from "@/lib/skeap-waitlist";
import {
  getSkeapWaitlistCycle,
  getSkeapWaitlistCycleState,
} from "@/lib/skeap-waitlist-cycle";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const REMINDER_OFFSETS_HOURS = [48, 24] as const;
const OFFER_SUBJECT = "A SKEAP scholarship slot is available";

type SettingsClient = typeof prisma | Prisma.TransactionClient;

type OfferEmail = {
  applicationId: string;
  userId: string;
  applicantName: string;
  email: string | null;
  queuePosition: number;
  waitlistOfferDays: number;
  expiresAt: Date;
  message: string;
};

function formatDeadline(value: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "long",
    timeStyle: "short",
  }).format(value);
}

function offerDurationDays(offeredAt: Date | null, expiresAt: Date) {
  return offeredAt
    ? Math.max(1, Math.round((expiresAt.getTime() - offeredAt.getTime()) / DAY_MS))
    : DEFAULT_SKEAP_WAITLIST_OFFER_DAYS;
}

export function getWaitlistOfferExpiresAt(offeredAt: Date, waitlistOfferDays: number) {
  return new Date(offeredAt.getTime() + waitlistOfferDays * DAY_MS);
}

export function getDueWaitlistOfferReminderOffsets(expiresAt: Date, now: Date) {
  const remainingMs = expiresAt.getTime() - now.getTime();
  if (remainingMs <= 0) return [];
  return REMINDER_OFFSETS_HOURS.filter(
    (hours) => remainingMs <= hours * HOUR_MS,
  );
}

export async function getSkeapWaitlistOfferDays(
  client: SettingsClient = prisma,
) {
  const setting = await client.systemSetting.findUnique({
    where: { key: SKEAP_WAITLIST_OFFER_DAYS_KEY },
    select: { value: true },
  });
  const value = setting?.value;
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_SKEAP_WAITLIST_OFFER_DAYS
    ? value
    : DEFAULT_SKEAP_WAITLIST_OFFER_DAYS;
}

export async function setSkeapWaitlistOfferDays(
  value: number,
  client: SettingsClient = prisma,
) {
  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_SKEAP_WAITLIST_OFFER_DAYS
  ) {
    throw new Error(
      `Waitlist offer window must be a whole number between 1 and ${MAX_SKEAP_WAITLIST_OFFER_DAYS} days.`,
    );
  }

  return client.systemSetting.upsert({
    where: { key: SKEAP_WAITLIST_OFFER_DAYS_KEY },
    create: { key: SKEAP_WAITLIST_OFFER_DAYS_KEY, value },
    update: { value },
  });
}

function buildOfferMessage(
  queuePosition: number,
  waitlistOfferDays: number,
  expiresAt: Date,
) {
  return `A SKEAP scholarship slot is now available for you (Queue #${queuePosition}). Please present your Original / Certified True Copy (CTC) documents at the Barangay Pico SK Office within ${waitlistOfferDays} days (on or before ${formatDeadline(expiresAt)}) to finalize your promotion, or your slot offer will automatically pass to the next applicant in line.`;
}

async function sendOfferEmails(offers: OfferEmail[]) {
  let emailSent = 0;
  let emailFailed = 0;
  let emailSkipped = 0;
  let transporter: ReturnType<typeof createGmailTransporter> | null = null;

  for (const offer of offers) {
    if (!offer.email) {
      emailSkipped += 1;
      continue;
    }

    try {
      transporter ??= createGmailTransporter();
      await sendTransactionalEmail(
        transporter,
        offer.email,
        OFFER_SUBJECT,
        offer.message,
        `waitlist-offer-${offer.applicationId}-${offer.expiresAt.toISOString()}`,
      );
      emailSent += 1;
    } catch (error) {
      emailFailed += 1;
      console.error("Failed to send SKEAP waitlist slot-offer email:", {
        applicationId: offer.applicationId,
        error: error instanceof Error ? error.message : "Unknown email delivery error",
      });
    }
  }

  return { emailSent, emailFailed, emailSkipped };
}

export async function dispatchWaitlistSlotOffers(now = new Date()) {
  const dispatch = await prisma.$transaction(async (tx) => {
    await lockSkeapCapacity(tx);
    const cycle = getSkeapWaitlistCycle();
    const cycleRange = getAcademicYearDateRange(cycle);
    if (!cycleRange) throw new Error("Unable to determine the active SKEAP waitlist cycle.");

    const cycleState = await getSkeapWaitlistCycleState(cycle, tx);
    const [activeGranteesCount, maxSlots, waitlistOfferDays, activeUnexpiredOffersCount] =
      await Promise.all([
        getSkeapCapacityCount(tx),
        getSkeapMaxSlots(tx),
        getSkeapWaitlistOfferDays(tx),
        tx.skeapApplication.count({
          where: {
            status: "WAITLISTED",
            waitlistOfferStatus: "OFFERED",
            waitlistOfferExpiresAt: { gt: now },
            submittedAt: { gte: cycleRange.start, lt: cycleRange.end },
          },
        }),
      ]);
    const availableSlots = cycleState.isClosed
      ? 0
      : Math.max(0, maxSlots - activeGranteesCount - activeUnexpiredOffersCount);

    if (availableSlots === 0) {
      return {
        offers: [] as OfferEmail[],
        activeGranteesCount,
        activeUnexpiredOffersCount,
        availableSlots,
        waitlistOfferDays,
      };
    }

    await reindexSkeapWaitlist(tx, cycle);
    const candidates = await tx.skeapApplication.findMany({
      where: {
        status: "WAITLISTED",
        waitlistOfferStatus: "NONE",
        submittedAt: { gte: cycleRange.start, lt: cycleRange.end },
      },
      orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
      take: availableSlots,
      select: {
        id: true,
        userId: true,
        applicantName: true,
        emailAddress: true,
        waitlistPosition: true,
        user: { select: { fullName: true, email: true } },
      },
    });

    const offers: OfferEmail[] = [];
    for (const [index, application] of candidates.entries()) {
      const expiresAt = getWaitlistOfferExpiresAt(now, waitlistOfferDays);
      const applicantName =
        application.applicantName || application.user.fullName || "SKEAP applicant";
      const queuePosition = application.waitlistPosition ?? index + 1;
      const message = buildOfferMessage(queuePosition, waitlistOfferDays, expiresAt);
      const updated = await tx.skeapApplication.updateMany({
        where: {
          id: application.id,
          status: "WAITLISTED",
          waitlistOfferStatus: "NONE",
        },
        data: {
          waitlistOfferStatus: "OFFERED",
          waitlistOfferedAt: now,
          waitlistOfferExpiresAt: expiresAt,
          waitlistOfferReminderSentAt: null,
        },
      });
      if (updated.count !== 1) continue;

      const sourceKey = `skeap-waitlist-offer:${application.id}:${expiresAt.toISOString()}`;
      await tx.notification.upsert({
        where: {
          userId_sourceKey: { userId: application.userId, sourceKey },
        },
        create: {
          userId: application.userId,
          sourceKey,
          message: `${OFFER_SUBJECT}: ${message}`,
        },
        update: { message: `${OFFER_SUBJECT}: ${message}`, isRead: false, readAt: null },
      });
      offers.push({
        applicationId: application.id,
        userId: application.userId,
        applicantName,
        email: application.emailAddress || application.user.email || null,
        queuePosition,
        waitlistOfferDays,
        expiresAt,
        message,
      });
    }

    return {
      offers,
      activeGranteesCount,
      activeUnexpiredOffersCount,
      availableSlots,
      waitlistOfferDays,
    };
  });

  const emailResult = await sendOfferEmails(dispatch.offers);
  return {
    offeredCount: dispatch.offers.length,
    availableSlots: dispatch.availableSlots,
    activeGranteesCount: dispatch.activeGranteesCount,
    activeUnexpiredOffersCount: dispatch.activeUnexpiredOffersCount,
    waitlistOfferDays: dispatch.waitlistOfferDays,
    ...emailResult,
  };
}

export async function processExpiredWaitlistOffers(now = new Date()) {
  const expiredOffers = await prisma.$transaction(async (tx) => {
    await lockSkeapCapacity(tx);
    const expired = await tx.skeapApplication.findMany({
      where: {
        status: "WAITLISTED",
        waitlistOfferStatus: "OFFERED",
        waitlistOfferExpiresAt: { lte: now },
      },
      select: {
        id: true,
        userId: true,
        applicantName: true,
        emailAddress: true,
        waitlistOfferedAt: true,
        waitlistOfferExpiresAt: true,
        user: { select: { fullName: true, email: true } },
      },
    });

    const notifications: Array<{
      applicationId: string;
      userId: string;
      applicantName: string;
      email: string | null;
      message: string;
      expiresAt: Date;
    }> = [];
    for (const application of expired) {
      const expiresAt = application.waitlistOfferExpiresAt;
      if (!expiresAt) continue;
      const days = offerDurationDays(application.waitlistOfferedAt, expiresAt);
      const applicantName =
        application.applicantName || application.user.fullName || "SKEAP applicant";
      const message =
        `Your ${days}-day physical CTC verification window for the SKEAP slot offer expired on ${formatDeadline(expiresAt)}. The slot has passed to the next applicant in line. Your application remains on the waitlist.`;
      const updated = await tx.skeapApplication.updateMany({
        where: {
          id: application.id,
          status: "WAITLISTED",
          waitlistOfferStatus: "OFFERED",
          waitlistOfferExpiresAt: { lte: now },
        },
        data: { waitlistOfferStatus: "EXPIRED" },
      });
      if (updated.count !== 1) continue;

      const sourceKey = `skeap-waitlist-expired:${application.id}:${expiresAt.toISOString()}`;
      await tx.notification.upsert({
        where: { userId_sourceKey: { userId: application.userId, sourceKey } },
        create: {
          userId: application.userId,
          sourceKey,
          message: `SKEAP slot offer expired: ${message}`,
        },
        update: { message: `SKEAP slot offer expired: ${message}`, isRead: false, readAt: null },
      });
      notifications.push({
        applicationId: application.id,
        userId: application.userId,
        applicantName,
        email: application.emailAddress || application.user.email || null,
        message,
        expiresAt,
      });
    }

    return notifications;
  });

  let emailSent = 0;
  let emailFailed = 0;
  let emailSkipped = 0;
  let transporter: ReturnType<typeof createGmailTransporter> | null = null;
  for (const expired of expiredOffers) {
    if (!expired.email) {
      emailSkipped += 1;
      continue;
    }
    try {
      transporter ??= createGmailTransporter();
      await sendTransactionalEmail(
        transporter,
        expired.email,
        "Your SKEAP slot offer has expired",
        expired.message,
        `waitlist-expired-${expired.applicationId}-${expired.expiresAt.toISOString()}`,
      );
      emailSent += 1;
    } catch (error) {
      emailFailed += 1;
      console.error("Failed to send SKEAP waitlist offer-expiration email:", {
        applicationId: expired.applicationId,
        error: error instanceof Error ? error.message : "Unknown email delivery error",
      });
    }
  }

  const dispatchResult = expiredOffers.length > 0
    ? await dispatchWaitlistSlotOffers(now)
    : null;
  return {
    expiredCount: expiredOffers.length,
    emailSent,
    emailFailed,
    emailSkipped,
    dispatchResult,
  };
}

type OfferReminderEmail = {
  logId: string;
  applicationId: string;
  applicantName: string;
  email: string | null;
  subject: string;
  message: string;
  expiresAt: Date;
  offsetHours: number;
};

export async function processWaitlistOfferReminders(now = new Date()) {
  const reminders = await prisma.$transaction(async (tx) => {
    await lockSkeapCapacity(tx);
    const cycle = getSkeapWaitlistCycle();
    const cycleRange = getAcademicYearDateRange(cycle);
    if (!cycleRange) throw new Error("Unable to determine the active SKEAP waitlist cycle.");

    const applications = await tx.skeapApplication.findMany({
      where: {
        status: "WAITLISTED",
        waitlistOfferStatus: "OFFERED",
        waitlistOfferExpiresAt: { gt: now },
        submittedAt: { gte: cycleRange.start, lt: cycleRange.end },
      },
      select: {
        id: true,
        userId: true,
        applicantName: true,
        emailAddress: true,
        waitlistOfferedAt: true,
        waitlistOfferExpiresAt: true,
        user: { select: { fullName: true, email: true } },
      },
    });
    const pendingEmails: OfferReminderEmail[] = [];

    for (const application of applications) {
      const expiresAt = application.waitlistOfferExpiresAt;
      if (!expiresAt) continue;
      const dueOffsets = getDueWaitlistOfferReminderOffsets(expiresAt, now);
      for (const offsetHours of dueOffsets) {
        const triggerDate = new Date(expiresAt.getTime() - offsetHours * HOUR_MS);
        const targetType = `SKEAP_WAITLIST_OFFER_${offsetHours}H`;
        const metadata = {
          applicationId: application.id,
          offerExpiresAt: expiresAt.toISOString(),
          offsetHours,
        } satisfies Prisma.InputJsonObject;
        const subject = `SKEAP slot offer expires in ${offsetHours} hours`;
        const applicantName =
          application.applicantName || application.user.fullName || "SKEAP applicant";
        const message =
          `Your SKEAP slot offer expires on ${formatDeadline(expiresAt)}. Please present your Original / Certified True Copy (CTC) documents at the Barangay Pico SK Office before the deadline to finalize your promotion.`;

        const existingInAppLog = await tx.reminderLog.findFirst({
          where: {
            userId: application.userId,
            reminderType: ReminderType.SKEAP_APPLICATION,
            targetType,
            targetId: application.id,
            triggerDate,
            channel: "in-app",
          },
          select: { id: true },
        });
        if (!existingInAppLog) {
          const inAppLog = await tx.reminderLog.create({
            data: {
              userId: application.userId,
              reminderType: ReminderType.SKEAP_APPLICATION,
              targetType,
              targetId: application.id,
              triggerDate,
              channel: "in-app",
              success: true,
              metadata: { ...metadata, subject, body: message },
            },
            select: { id: true },
          });
          const sourceKey = `reminder:${inAppLog.id}`;
          await tx.notification.upsert({
            where: {
              userId_sourceKey: { userId: application.userId, sourceKey },
            },
            create: {
              userId: application.userId,
              sourceKey,
              message: `${subject}: ${message}`,
            },
            update: { message: `${subject}: ${message}` },
          });
        }

        const existingEmailLog = await tx.reminderLog.findFirst({
          where: {
            userId: application.userId,
            reminderType: ReminderType.SKEAP_APPLICATION,
            targetType,
            targetId: application.id,
            triggerDate,
            channel: "email",
          },
          select: { id: true, success: true, metadata: true },
        });
        const existingMetadata =
          typeof existingEmailLog?.metadata === "object" &&
          existingEmailLog.metadata !== null &&
          !Array.isArray(existingEmailLog.metadata)
            ? existingEmailLog.metadata as Record<string, unknown>
            : {};
        const deliveryStatus = existingMetadata.deliveryStatus;
        if (
          existingEmailLog?.success &&
          (deliveryStatus === "sent" || deliveryStatus === "skipped")
        ) {
          continue;
        }

        const emailLog = existingEmailLog
          ? await tx.reminderLog.update({
              where: { id: existingEmailLog.id },
              data: {
                success: false,
                sentAt: now,
                metadata: { ...metadata, subject, body: message, deliveryStatus: "pending" },
              },
              select: { id: true },
            })
          : await tx.reminderLog.create({
              data: {
                userId: application.userId,
                reminderType: ReminderType.SKEAP_APPLICATION,
                targetType,
                targetId: application.id,
                triggerDate,
                channel: "email",
                success: false,
                sentAt: now,
                metadata: { ...metadata, subject, body: message, deliveryStatus: "pending" },
              },
              select: { id: true },
            });
        pendingEmails.push({
          logId: emailLog.id,
          applicationId: application.id,
          applicantName,
          email: application.emailAddress || application.user.email || null,
          subject,
          message,
          expiresAt,
          offsetHours,
        });
      }

      if (dueOffsets.length > 0) {
        await tx.skeapApplication.update({
          where: { id: application.id },
          data: { waitlistOfferReminderSentAt: now },
        });
      }
    }

    return pendingEmails;
  });

  let emailSent = 0;
  let emailFailed = 0;
  let emailSkipped = 0;
  let transporter: ReturnType<typeof createGmailTransporter> | null = null;
  for (const reminder of reminders) {
    if (!reminder.email) {
      emailSkipped += 1;
      await prisma.reminderLog.update({
        where: { id: reminder.logId },
        data: {
          success: true,
          metadata: {
            applicationId: reminder.applicationId,
            offerExpiresAt: reminder.expiresAt.toISOString(),
            offsetHours: reminder.offsetHours,
            subject: reminder.subject,
            body: reminder.message,
            deliveryStatus: "skipped",
          },
        },
      });
      continue;
    }

    try {
      transporter ??= createGmailTransporter();
      await sendTransactionalEmail(
        transporter,
        reminder.email,
        reminder.subject,
        reminder.message,
        `waitlist-reminder-${reminder.applicationId}-${reminder.offsetHours}h-${reminder.expiresAt.toISOString()}`,
      );
      await prisma.reminderLog.update({
        where: { id: reminder.logId },
        data: {
          success: true,
          metadata: {
            applicationId: reminder.applicationId,
            offerExpiresAt: reminder.expiresAt.toISOString(),
            offsetHours: reminder.offsetHours,
            subject: reminder.subject,
            body: reminder.message,
            deliveryStatus: "sent",
          },
        },
      });
      emailSent += 1;
    } catch (error) {
      await prisma.reminderLog.update({
        where: { id: reminder.logId },
        data: {
          success: false,
          metadata: {
            applicationId: reminder.applicationId,
            offerExpiresAt: reminder.expiresAt.toISOString(),
            offsetHours: reminder.offsetHours,
            subject: reminder.subject,
            body: reminder.message,
            deliveryStatus: "failed",
            error: error instanceof Error ? error.message : "Unknown email delivery error",
          },
        },
      });
      emailFailed += 1;
      console.error("Failed to send SKEAP waitlist offer reminder:", {
        applicationId: reminder.applicationId,
        offsetHours: reminder.offsetHours,
        error: error instanceof Error ? error.message : "Unknown email delivery error",
      });
    }
  }

  return {
    reminderCount: reminders.length,
    emailSent,
    emailFailed,
    emailSkipped,
  };
}
