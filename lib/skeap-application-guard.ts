import { SKEAP_UPLOAD_KEY } from "@/lib/skeap-upload";
import {
  DEFAULT_ACTIVE_SKEAP_EDUCATION_LEVELS,
  getSkeapEducationLevelCode,
  type SkeapEducationLevelCode,
  SKEAP_EDUCATION_LEVEL_OPTIONS,
} from "@/lib/skeap-education";
export {
  DEFAULT_ACTIVE_SKEAP_EDUCATION_LEVELS,
  SKEAP_EDUCATION_LEVEL_OPTIONS,
} from "@/lib/skeap-education";

export type IdentityFingerprintInput = {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | Date | null;
};

export type IdentityFingerprint = {
  exact: string;
  loose: string;
};

export type PermanentSkeapRevocationRecord = IdentityFingerprintInput & {
  id: string;
  userId: string;
  kkProfileId: string | null;
  identityFingerprint: string | null;
  isPermanentlyDisqualified: boolean;
  reason: string | null;
  fullName: string;
  revokedAt: string | null;
};

export type SkeapIdentityCandidate = IdentityFingerprintInput & {
  userId: string;
  kkProfileId?: string | null;
  applicantName?: string | null;
};

export type BanWatchlistMatch = {
  id: string;
  fullName: string;
  revokedAt: string | null;
  reason: string | null;
};

const VOTER_ELIGIBILITY_ERROR =
  "Ineligible under Section 3(6): Applicants who have reached voting age (18+) must be duly registered voters of Barangay Pico to qualify for SKEAP.";
const PERMANENT_DISQUALIFICATION_MESSAGE =
  "You are permanently ineligible to reapply for SKEAP due to a prior conduct or disciplinary revocation.";
const SKEAP_APPLICATION_REAPPLICATION_BLOCKING_STATUSES = new Set([
  "PENDING",
  "UNDER_REVIEW",
  "PRE_QUALIFIED",
  "RETURNED",
  "RETURNED_FOR_EDIT",
  "RESUBMITTED",
  "WAITLISTED",
  "APPROVED",
  "REVOKED",
  "REMOVED",
]);
export const SKEAP_EDUCATION_LEVEL_CLOSED_ERROR =
  "This education category is not open for the current SKEAP cycle. Please select an available category.";

function normalizeActiveEducationLevels(value: unknown): SkeapEducationLevelCode[] {
  if (!Array.isArray(value)) return [];
  const normalized: SkeapEducationLevelCode[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const candidate = item.trim().toLowerCase();
    const option = SKEAP_EDUCATION_LEVEL_OPTIONS.find(
      ({ value: code, label }) =>
        code.toLowerCase() === candidate || label.toLowerCase() === candidate,
    );
    if (option && !normalized.includes(option.value)) normalized.push(option.value);
  }
  return normalized;
}

export async function getActiveSkeapEducationLevels(
  lookupConfiguredLevels: () => Promise<unknown> = async () => {
    const { getActiveSkeapEducationLevels: getConfiguredLevels } =
      await import("@/lib/skeap-program-config");
    return getConfiguredLevels();
  },
): Promise<SkeapEducationLevelCode[]> {
  try {
    const levels = normalizeActiveEducationLevels(await lookupConfiguredLevels());
    return levels.length ? levels : [...DEFAULT_ACTIVE_SKEAP_EDUCATION_LEVELS];
  } catch (error) {
    console.error("Unable to load current SKEAP education categories; using defaults.", error);
    return [...DEFAULT_ACTIVE_SKEAP_EDUCATION_LEVELS];
  }
}

export function getSkeapEducationLevelGuardError(
  educationLevel: string,
  activeEducationLevels: readonly SkeapEducationLevelCode[] = DEFAULT_ACTIVE_SKEAP_EDUCATION_LEVELS,
) {
  const code = getSkeapEducationLevelCode(educationLevel);
  return code && activeEducationLevels.includes(code)
    ? null
    : SKEAP_EDUCATION_LEVEL_CLOSED_ERROR;
}

function normalizeIdentityName(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeIdentityDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function buildIdentityFingerprint({
  firstName,
  middleName,
  lastName,
  dateOfBirth,
}: IdentityFingerprintInput): IdentityFingerprint | null {
  const normalizedFirst = normalizeIdentityName(firstName);
  const normalizedMiddle = normalizeIdentityName(middleName);
  const normalizedLast = normalizeIdentityName(lastName);
  const normalizedDate = normalizeIdentityDate(dateOfBirth);
  if (!normalizedFirst || !normalizedLast || !normalizedDate) return null;

  return {
    exact: `${normalizedLast}|${normalizedFirst}|${normalizedMiddle}|${normalizedDate}`,
    loose: `${normalizedLast}|${normalizedDate}`,
  };
}

export function parseSkeapApplicantName(value: string | null | undefined) {
  const name = value?.trim();
  if (!name) return null;

  const commaIndex = name.indexOf(",");
  if (commaIndex >= 0) {
    const lastName = name.slice(0, commaIndex).trim();
    const givenNames = name.slice(commaIndex + 1).trim().split(/\s+/).filter(Boolean);
    if (!lastName || !givenNames.length) return null;
    return {
      firstName: givenNames[0],
      middleName: givenNames.slice(1).join(" "),
      lastName,
    };
  }

  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

export function isPermanentlyBarredFromSkeap(
  revocationRecord:
    | { isPermanentlyDisqualified?: boolean | null; reason?: string | null }
    | null
    | undefined,
) {
  const reason = revocationRecord?.reason ?? "";
  return Boolean(
    revocationRecord?.isPermanentlyDisqualified ||
      /unbecoming|crime|criminal|falsification/i.test(reason) ||
      /tampered|falsified/i.test(reason),
  );
}

function getCandidateNames(candidate: SkeapIdentityCandidate) {
  const parsedName = parseSkeapApplicantName(candidate.applicantName);
  return {
    firstName: normalizeIdentityName(candidate.firstName || parsedName?.firstName),
    lastName: normalizeIdentityName(candidate.lastName || parsedName?.lastName),
  };
}

export function findPermanentDisqualificationMatch(
  records: readonly PermanentSkeapRevocationRecord[],
  candidate: SkeapIdentityCandidate,
) {
  const candidateFingerprint = buildIdentityFingerprint(candidate);
  return records.find((record) => {
    if (!isPermanentlyBarredFromSkeap(record)) return false;
    return (
      record.userId === candidate.userId ||
      Boolean(candidate.kkProfileId && record.kkProfileId === candidate.kkProfileId) ||
      Boolean(
        candidateFingerprint &&
          (record.identityFingerprint === candidateFingerprint.exact ||
            buildIdentityFingerprint(record)?.exact === candidateFingerprint.exact),
      )
    );
  }) ?? null;
}

export function getSkeapReapplicationEligibility(
  records: readonly PermanentSkeapRevocationRecord[],
  candidate: SkeapIdentityCandidate,
) {
  const matchedRecord = findPermanentDisqualificationMatch(records, candidate);
  return matchedRecord
    ? {
        eligible: false as const,
        reason: "PERMANENTLY_DISQUALIFIED" as const,
        message: PERMANENT_DISQUALIFICATION_MESSAGE,
      }
    : { eligible: true as const };
}

export function isSkeapApplicationBlockingReapplication(status: string | null | undefined) {
  return SKEAP_APPLICATION_REAPPLICATION_BLOCKING_STATUSES.has(
    status?.trim().toUpperCase() ?? "",
  );
}

export function findBanWatchlistMatch(
  records: readonly PermanentSkeapRevocationRecord[],
  candidate: SkeapIdentityCandidate,
): BanWatchlistMatch | null {
  if (findPermanentDisqualificationMatch(records, candidate)) return null;

  const candidateFingerprint = buildIdentityFingerprint(candidate);
  const candidateNames = getCandidateNames(candidate);
  if (!candidateNames.firstName || !candidateNames.lastName) return null;

  const match = records.find((record) => {
    if (!isPermanentlyBarredFromSkeap(record)) return false;
    const recordFingerprint =
      record.identityFingerprint?.split("|").length === 4
        ? record.identityFingerprint
        : buildIdentityFingerprint(record)?.exact;
    const [recordLastName, recordFirstName, , recordDateOfBirth] =
      recordFingerprint?.split("|") ?? [];
    const matchesLastNameAndBirthDate = Boolean(
      candidateFingerprint &&
        recordLastName &&
        recordDateOfBirth &&
        candidateFingerprint.loose === `${recordLastName}|${recordDateOfBirth}`,
    );
    const matchesFirstAndLastName = Boolean(
      recordFirstName &&
        recordLastName &&
        candidateNames.firstName === recordFirstName &&
        candidateNames.lastName === recordLastName,
    );
    return matchesLastNameAndBirthDate || matchesFirstAndLastName;
  });

  return match
    ? {
        id: match.id,
        fullName: match.fullName,
        revokedAt: match.revokedAt,
        reason: match.reason,
      }
    : null;
}

type SkeapSubmissionGuardInput = {
  age: number;
  registeredVoter: boolean;
  parentGuardianRegisteredVoter: boolean;
  parentGuardianVoterFullName: string;
  uploadedFiles: Record<string, { url?: string }> | null;
};

export function getSkeapSubmissionGuardError({
  age,
  registeredVoter,
  parentGuardianRegisteredVoter,
  parentGuardianVoterFullName,
  uploadedFiles,
}: SkeapSubmissionGuardInput): string | null {
  if (age >= 18 && !registeredVoter) return VOTER_ELIGIBILITY_ERROR;

  if (age < 18 && !registeredVoter) {
    if (!parentGuardianRegisteredVoter) {
      return "A parent or legal guardian must be a duly registered voter of Barangay Pico.";
    }
    if (parentGuardianVoterFullName.trim().length < 3) {
      return "Enter the registered parent or legal guardian's full name (at least 3 characters).";
    }
  }

  const requiredUploadKeys = [
    SKEAP_UPLOAD_KEY.FAMILY_INCOME,
    SKEAP_UPLOAD_KEY.ENROLLMENT_CERT,
    SKEAP_UPLOAD_KEY.GRADE_REPORT,
    SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE,
  ];
  const missingUploadKeys = requiredUploadKeys.filter(
    (key) => !uploadedFiles?.[key]?.url?.trim(),
  );

  return missingUploadKeys.length
    ? `Missing required uploadedFiles keys: ${missingUploadKeys.join(", ")}`
    : null;
}
