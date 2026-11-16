import { Prisma, SubmissionStatus } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit/logger";
import { getCurrentAcademicYear } from "@/lib/semester";
import { reindexSkeapWaitlist } from "@/lib/skeap-waitlist";

export async function closeOpenSkeapApplicationsForKkArchive(
  tx: Prisma.TransactionClient,
  {
    userId,
    actorId,
    reason,
    message,
  }: {
    userId: string;
    actorId: string;
    reason: string;
    message: string;
  },
) {
  const applications = await tx.skeapApplication.findMany({
    where: {
      userId,
      status: { in: [SubmissionStatus.PENDING, SubmissionStatus.WAITLISTED] },
    },
    select: {
      id: true,
      status: true,
      submittedAt: true,
      waitlistPosition: true,
      inquiry: { select: { id: true } },
    },
  });
  const affectedCycles = new Set<string>();
  let closedCount = 0;

  for (const application of applications) {
    const withdrawnAt = new Date();
    const update = await tx.skeapApplication.updateMany({
      where: {
        id: application.id,
        userId,
        status: application.status,
      },
      data: {
        status: SubmissionStatus.WITHDRAWN,
        waitlistPosition: null,
        waitlistFinalPosition: null,
        withdrawnAt,
        withdrawalReason: message,
        waitlistRemark: `KK_PROFILE_ARCHIVED:${reason}`,
      },
    });
    if (update.count !== 1) continue;

    if (application.status === SubmissionStatus.WAITLISTED) {
      affectedCycles.add(getCurrentAcademicYear(application.submittedAt));
    }

    if (application.inquiry) {
      await tx.inquiry.update({
        where: { id: application.inquiry.id },
        data: {
          isResolved: true,
          response: message,
          respondedAt: withdrawnAt,
          reviewStatus: "Withdrawn",
          lastUpdatedBy: actorId,
        },
      });
    }

    const sourceKey = `kk-profile-archive:${application.id}`;
    const granteeMessage = await tx.granteeMessage.create({
      data: {
        userId,
        senderId: actorId,
        subject: "SKEAP application closed",
        body: message,
      },
      select: { id: true },
    });
    await tx.notification.upsert({
      where: { userId_sourceKey: { userId, sourceKey } },
      create: {
        userId,
        sourceKey,
        message: `SKEAP application closed\n\n${message}`,
      },
      update: { message: `SKEAP application closed\n\n${message}` },
    });
    await writeAuditLog(tx, {
      action: "SKEAP_APPLICATION_WITHDRAWN",
      actorId,
      targetTable: "skeap_applications",
      targetId: application.id,
      beforeData: {
        status: application.status,
        waitlistPosition: application.waitlistPosition,
      },
      afterData: {
        status: SubmissionStatus.WITHDRAWN,
        withdrawnAt: withdrawnAt.toISOString(),
        waitlistPosition: null,
        waitlistRemark: `KK_PROFILE_ARCHIVED:${reason}`,
      },
      metadata: {
        reason: "KK_PROFILE_ARCHIVED",
        archiveReason: reason,
        notificationId: granteeMessage.id,
      },
    });
    closedCount += 1;
  }

  for (const cycle of affectedCycles) {
    await reindexSkeapWaitlist(tx, cycle);
  }

  return { closedCount };
}
