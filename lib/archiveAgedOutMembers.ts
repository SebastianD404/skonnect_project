import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/logger";
import { closeOpenSkeapApplicationsForKkArchive } from "@/lib/kk-archive-skeap-applications";
import { syncKkProfileFromLatestRegistration } from "@/lib/kk-profile-sync";
import {
  refreshKkProfilingApplicationsAdminView,
  refreshSkeapApplicationsAdminView,
  refreshSystemUsersAdminView,
} from "@/lib/application-admin-view-refresh";
import { createGmailTransporter, sendBroadcastEmail } from "@/lib/broadcast-email";
import { getAgeOutCutoffDate, getExactAge } from "@/lib/skeap-age";
import {
  KK_MEMBER_AGE_OUT_NOTICE_MESSAGE,
  KK_MEMBER_AGE_OUT_REASON,
} from "@/lib/kk-member-archive";

type AgedOutNotificationRecipient = {
  userId: string;
  email: string;
  fullName: string;
  message: string;
};

export async function sweepAgedOutKkProfiles(
  actorId: string,
  trigger: "admin-page" | "scheduled" | "profile-save" = "admin-page",
  options: { resubmittedRegistrationId?: string } = {},
) {
  const today = new Date();
  const cutoffDate = getAgeOutCutoffDate(today);
  const where = options.resubmittedRegistrationId
    ? {
        program: "KK",
        birthDate: { lte: cutoffDate },
        OR: [
          { reviewStatus: "Approved" },
          {
            id: options.resubmittedRegistrationId,
            reviewStatus: "Resubmitted",
          },
        ],
      }
    : {
        program: "KK",
        reviewStatus: "Approved",
        birthDate: { lte: cutoffDate },
      };

  const profiles = await prisma.profilingRegistration.findMany({
    where,
    select: {
      id: true,
      fullName: true,
      birthDate: true,
      reviewStatus: true,
      archivedReason: true,
      archivedAt: true,
      userId: true,
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          emailNotifications: true,
          kkStatus: true,
        },
      },
    },
  });

  let archivedCount = 0;
  let closedApplicationCount = 0;
  const emailRecipients: AgedOutNotificationRecipient[] = [];

  for (const profile of profiles) {
    const currentAge = getExactAge(profile.birthDate, today);
    if (currentAge === null || currentAge < 31) continue;

    const archivedAt = new Date();
    const notice = `${KK_MEMBER_AGE_OUT_NOTICE_MESSAGE} Your recorded age is ${currentAge}.`;
    const result = await prisma.$transaction(async (tx) => {
      const archived = await tx.profilingRegistration.updateMany({
        where: {
          id: profile.id,
          reviewStatus: profile.reviewStatus,
          birthDate: { lte: cutoffDate },
        },
        data: {
          reviewStatus: "Archived",
          archivedReason: KK_MEMBER_AGE_OUT_REASON,
          archivedAt,
          archivedBy: "SYSTEM_AUTO",
        },
      });
      if (archived.count !== 1) return null;

      let closedApplications = 0;
      if (profile.userId) {
        await tx.user.update({
          where: { id: profile.userId },
          data: { kkStatus: "AGED_OUT" },
        });
        await syncKkProfileFromLatestRegistration(tx, profile.userId);
        const closed = await closeOpenSkeapApplicationsForKkArchive(tx, {
          userId: profile.userId,
          actorId,
          reason: KK_MEMBER_AGE_OUT_REASON,
          message: `Your pending or waitlisted SKEAP application was closed because your KK Youth Registry profile was automatically archived after you reached age ${currentAge}.`,
        });
        closedApplications = closed.closedCount;

        const sourceKey = `kk-age-out:${profile.id}`;
        const message = await tx.granteeMessage.create({
          data: {
            userId: profile.userId,
            senderId: actorId,
            subject: "KK Youth Registry age limit reached",
            body: notice,
          },
          select: { id: true },
        });
        await tx.notification.upsert({
          where: { userId_sourceKey: { userId: profile.userId, sourceKey } },
          create: {
            userId: profile.userId,
            sourceKey,
            message: `KK age-limit update: ${notice}`,
          },
          update: { message: `KK age-limit update: ${notice}` },
        });
        if (profile.user?.emailNotifications && profile.user.email) {
          emailRecipients.push({
            userId: profile.user.id,
            email: profile.user.email,
            fullName: profile.user.fullName || profile.fullName,
            message: notice,
          });
        }

        await writeAuditLog(tx, {
          action: "KK_PROFILE_AGE_OUT_NOTIFIED",
          actorId,
          targetTable: "kk_profiling_registrations",
          targetId: profile.id,
          metadata: {
            currentAge,
            maxEligibleAge: 30,
            notificationId: message.id,
            closedApplicationCount: closedApplications,
            trigger,
          },
        });
      }

      await writeAuditLog(tx, {
        action: "PROFILE_ARCHIVED",
        actorId,
        targetTable: "kk_profiling_registrations",
        targetId: profile.id,
        beforeData: {
          reviewStatus: profile.reviewStatus,
          archivedReason: profile.archivedReason,
          archivedAt: profile.archivedAt,
        },
        afterData: {
          reviewStatus: "Archived",
          archivedReason: KK_MEMBER_AGE_OUT_REASON,
          archivedAt: archivedAt.toISOString(),
          archivedBy: "SYSTEM_AUTO",
          ...(profile.userId ? { kkStatus: "AGED_OUT" } : {}),
        },
        metadata: {
          fullName: profile.fullName,
          birthDate: profile.birthDate.toISOString(),
          currentAge,
          accountRemainsActive: true,
          trigger,
        },
      });

      return { closedApplications };
    });

    if (result) {
      archivedCount += 1;
      closedApplicationCount += result.closedApplications;
    }
  }

  if (archivedCount > 0) {
    await Promise.all([
      refreshKkProfilingApplicationsAdminView(),
      refreshSkeapApplicationsAdminView(),
      refreshSystemUsersAdminView(),
    ]);
  }

  const emailRecipientsToNotify = emailRecipients.filter((recipient) => recipient.email);
  if (
    process.env.GMAIL_USER &&
    process.env.GMAIL_APP_PASSWORD &&
    emailRecipientsToNotify.length > 0
  ) {
    try {
      const transporter = createGmailTransporter();
      const results = await Promise.allSettled(
        emailRecipientsToNotify.map((recipient) =>
          sendBroadcastEmail(
            transporter,
            recipient.userId,
            recipient.email,
            "KK Youth Registry age limit reached",
            `Dear ${recipient.fullName},\n\n${recipient.message}`,
          ),
        ),
      );
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          console.error("Could not send KK age-out notification email.", {
            userId: emailRecipientsToNotify[index]?.userId,
            error: result.reason,
          });
        }
      });
    } catch (error) {
      console.error("Could not initialize KK age-out notification email delivery.", error);
    }
  }

  return { archivedCount, closedApplicationCount };
}

export const checkAndArchiveAgedOutMembers = sweepAgedOutKkProfiles;
