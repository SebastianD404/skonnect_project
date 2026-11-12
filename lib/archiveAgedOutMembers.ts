import { GranteeStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/logger";
import { refreshInactiveGranteesView } from "@/lib/grantee-archive-view";

const AGED_OUT_REASON = "Aged Out (31+)";
const AGED_OUT_GRANTEE_REMARK = "Disqualified: Exceeded KK age limit (Turned 31)";

export async function checkAndArchiveAgedOutMembers(actorId: string) {
  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - 31);

  const profiles = await prisma.profilingRegistration.findMany({
    where: {
      reviewStatus: "Approved",
      birthDate: { lte: cutoffDate },
    },
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
          grantee: {
            select: { id: true, status: true, remarks: true },
          },
        },
      },
    },
  });

  let archivedCount = 0;
  let removedGranteeCount = 0;
  for (const profile of profiles) {
    const archivedAt = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const archived = await tx.profilingRegistration.updateMany({
        where: {
          id: profile.id,
          reviewStatus: "Approved",
          birthDate: { lte: cutoffDate },
        },
        data: {
          reviewStatus: "Archived",
          archivedReason: AGED_OUT_REASON,
          archivedAt,
        },
      });
      if (archived.count !== 1) return { archived: false, granteeRemoved: false };

      const grantee = profile.user?.grantee;
      let granteeRemoved = false;
      if (grantee?.status === GranteeStatus.ACTIVE) {
        const removed = await tx.grantee.updateMany({
          where: { id: grantee.id, status: GranteeStatus.ACTIVE },
          data: {
            status: GranteeStatus.REMOVED,
            dateRemoved: archivedAt,
            remarks: AGED_OUT_GRANTEE_REMARK,
          },
        });
        granteeRemoved = removed.count === 1;
        if (granteeRemoved) {
          await writeAuditLog(tx, {
            action: "GRANTEE_STATUS_CHANGED",
            actorId,
            targetTable: "grantees",
            targetId: grantee.id,
            beforeData: { status: grantee.status, remarks: grantee.remarks },
            afterData: {
              status: GranteeStatus.REMOVED,
              dateRemoved: archivedAt.toISOString(),
              remarks: AGED_OUT_GRANTEE_REMARK,
            },
            metadata: { reason: AGED_OUT_REASON, profileId: profile.id },
          });
        }
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
          archivedReason: AGED_OUT_REASON,
          archivedAt: archivedAt.toISOString(),
        },
        metadata: { fullName: profile.fullName, birthDate: profile.birthDate.toISOString() },
      });

      return { archived: true, granteeRemoved };
    });

    if (result.archived) archivedCount += 1;
    if (result.granteeRemoved) removedGranteeCount += 1;
  }

  if (removedGranteeCount > 0) {
    await refreshInactiveGranteesView();
  }

  return { archivedCount, removedGranteeCount };
}
