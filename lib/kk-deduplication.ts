import type { Prisma } from "@prisma/client";

export type KkDuplicateFlag = "NAMESAKE_MATCH" | "TWIN_HOUSEHOLD_MATCH";

export interface KkDeduplicationIdentity {
  firstName: string | null | undefined;
  middleName: string | null | undefined;
  lastName: string | null | undefined;
  suffix?: string | null;
  birthDate: Date | string;
  sitio: string | null | undefined;
}

export interface KkDeduplicationCandidate extends KkDeduplicationIdentity {
  userId: string;
  status: string;
}

export interface KkDuplicateAssessment {
  isExactDuplicate: boolean;
  duplicateFlag: KkDuplicateFlag | null;
  duplicateNote: string | null;
}

export async function getKkProfileDuplicateAssessment(
  tx: Prisma.TransactionClient,
  identity: KkDeduplicationIdentity,
  currentUserId: string,
) {
  const profiles = await tx.kKProfile.findMany({
    where: {
      user: {
        is: {
          id: { not: currentUserId },
          kkStatus: { in: ["PENDING", "APPROVED"] },
        },
      },
    },
    select: {
      firstName: true,
      middleName: true,
      lastName: true,
      birthDate: true,
      purok: true,
      user: { select: { id: true, kkStatus: true } },
    },
  });

  return assessKkProfileDuplicates(
    identity,
    profiles.flatMap((profile) =>
      profile.user
        ? [{
            firstName: profile.firstName,
            middleName: profile.middleName,
            lastName: profile.lastName,
            birthDate: profile.birthDate,
            sitio: profile.purok,
            userId: profile.user.id,
            status: profile.user.kkStatus,
          }]
        : [],
    ),
    currentUserId,
  );
}

const DUPLICATE_NOTES: Record<KkDuplicateFlag, string> = {
  NAMESAKE_MATCH:
    "Shares full name with an existing registrant (different birthdate). Verify ID before approval.",
  TWIN_HOUSEHOLD_MATCH:
    "Shares middle/last name, birthdate, and sitio with another registrant (possible twin).",
};

function normalizeSuffix(value: string | null | undefined) {
  const suffix = normalizeKkDeduplicationName(value).replace(/[.,]/g, "");
  const suffixes: Record<string, string> = {
    JR: "JR",
    JUNIOR: "JR",
    SR: "SR",
    SENIOR: "SR",
    "2ND": "II",
    II: "II",
    "3RD": "III",
    III: "III",
    "4TH": "IV",
    IV: "IV",
    "5TH": "V",
    V: "V",
  };
  return suffixes[suffix] ?? suffix;
}

export function normalizeKkDeduplicationName(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

function normalizedIdentity(identity: KkDeduplicationIdentity) {
  return {
    firstName: normalizeKkDeduplicationName(identity.firstName),
    middleName: normalizeKkDeduplicationName(identity.middleName),
    lastName: normalizeKkDeduplicationName(identity.lastName),
    suffix: normalizeSuffix(identity.suffix),
    birthDate:
      identity.birthDate instanceof Date
        ? identity.birthDate.toISOString().slice(0, 10)
        : String(identity.birthDate).slice(0, 10),
    sitio: normalizeKkDeduplicationName(identity.sitio),
  };
}

export function assessKkProfileDuplicates(
  identity: KkDeduplicationIdentity,
  candidates: KkDeduplicationCandidate[],
  currentUserId: string,
): KkDuplicateAssessment {
  const current = normalizedIdentity(identity);
  const eligibleCandidates = candidates
    .filter(
      (candidate) =>
        candidate.userId !== currentUserId &&
        ["PENDING", "APPROVED"].includes(candidate.status.trim().toUpperCase()),
    )
    .map((candidate) => ({ candidate, normalized: normalizedIdentity(candidate) }));

  const hasExactMatch = eligibleCandidates.some(
    ({ normalized }) =>
      normalized.firstName === current.firstName &&
      normalized.middleName === current.middleName &&
      normalized.lastName === current.lastName &&
      normalized.suffix === current.suffix &&
      normalized.birthDate === current.birthDate,
  );
  if (hasExactMatch) {
    return { isExactDuplicate: true, duplicateFlag: null, duplicateNote: null };
  }

  const hasNamesake = eligibleCandidates.some(
    ({ normalized }) =>
      normalized.firstName === current.firstName &&
      normalized.middleName === current.middleName &&
      normalized.lastName === current.lastName &&
      normalized.suffix === current.suffix &&
      normalized.birthDate !== current.birthDate,
  );
  if (hasNamesake) {
    return {
      isExactDuplicate: false,
      duplicateFlag: "NAMESAKE_MATCH",
      duplicateNote: DUPLICATE_NOTES.NAMESAKE_MATCH,
    };
  }

  const hasTwinHouseholdMatch = eligibleCandidates.some(
    ({ normalized }) =>
      normalized.middleName === current.middleName &&
      normalized.lastName === current.lastName &&
      normalized.birthDate === current.birthDate &&
      normalized.sitio === current.sitio &&
      normalized.firstName !== current.firstName,
  );
  if (hasTwinHouseholdMatch) {
    return {
      isExactDuplicate: false,
      duplicateFlag: "TWIN_HOUSEHOLD_MATCH",
      duplicateNote: DUPLICATE_NOTES.TWIN_HOUSEHOLD_MATCH,
    };
  }

  return { isExactDuplicate: false, duplicateFlag: null, duplicateNote: null };
}
