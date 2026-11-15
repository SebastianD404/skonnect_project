import "server-only";

import { GranteeStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  isPermanentlyBarredFromSkeap,
  parseSkeapApplicantName,
  type PermanentSkeapRevocationRecord,
} from "@/lib/skeap-application-guard";

const LEGACY_PERMANENT_BAN_TERMS = [
  "unbecoming",
  "crime",
  "criminal",
  "falsification",
  "tampered",
  "falsified",
] as const;

const legacyReasonFilters: Prisma.GranteeWhereInput[] = LEGACY_PERMANENT_BAN_TERMS.flatMap((term) => [
  { revocationReason: { contains: term, mode: Prisma.QueryMode.insensitive } },
  { remarks: { contains: term, mode: Prisma.QueryMode.insensitive } },
]);

type GranteeQueryClient = Pick<Prisma.TransactionClient, "grantee">;

export async function getPermanentlyDisqualifiedSkeapRecords(
  client: GranteeQueryClient = prisma,
): Promise<PermanentSkeapRevocationRecord[]> {
  const records = await client.grantee.findMany({
    where: {
      OR: [
        { isPermanentlyDisqualified: true },
        {
          status: { in: [GranteeStatus.REVOKED, GranteeStatus.REMOVED] },
          OR: legacyReasonFilters,
        },
      ],
    },
    select: {
      id: true,
      userId: true,
      status: true,
      dateRemoved: true,
      revocationReason: true,
      remarks: true,
      isPermanentlyDisqualified: true,
      identityFingerprint: true,
      user: {
        select: {
          id: true,
          fullName: true,
          kkProfileId: true,
          kkProfile: {
            select: {
              firstName: true,
              middleName: true,
              lastName: true,
              fullName: true,
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

  return records.flatMap((record) => {
    const reason = record.revocationReason?.trim() || record.remarks?.trim() || "";
    if (!isPermanentlyBarredFromSkeap({
      isPermanentlyDisqualified: record.isPermanentlyDisqualified,
      reason,
    })) {
      return [];
    }

    const application = record.user.skeapApplications[0];
    const parsedApplicationName = parseSkeapApplicantName(application?.applicantName);
    const profile = record.user.kkProfile;

    return [{
      id: record.id,
      userId: record.userId,
      kkProfileId: record.user.kkProfileId,
      identityFingerprint: record.identityFingerprint,
      isPermanentlyDisqualified: record.isPermanentlyDisqualified,
      reason: reason.split(/Additional Notes:/i, 1)[0].trim() || null,
      fullName: profile?.fullName || record.user.fullName,
      revokedAt: record.dateRemoved?.toISOString() ?? null,
      firstName: profile?.firstName || parsedApplicationName?.firstName || null,
      middleName: profile?.middleName || parsedApplicationName?.middleName || null,
      lastName: profile?.lastName || parsedApplicationName?.lastName || null,
      dateOfBirth: profile?.birthDate ?? application?.dateOfBirth ?? null,
    }];
  });
}
