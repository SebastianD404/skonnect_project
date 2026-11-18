export const KK_MEMBER_AGE_OUT_REASON = "AGED_OUT" as const;

export const KK_MEMBER_AGE_OUT_NOTICE_MESSAGE =
  "Your KK youth profile has been archived because you reached age 31, above the KK age limit of 30. Any pending or waitlisted SKEAP application has been closed. Active scholarship records are managed separately in Active Grantees. Your SKonnect login remains active. If your recorded birth date is wrong or you believe this is a mistake, contact Barangay Pico SK officials to request a profile review.";

export const KK_MEMBER_ARCHIVE_REASONS = [
  "Transferred Residence",
  "Deceased",
  "Duplicate Record",
] as const;

export type KKMemberArchiveReason = (typeof KK_MEMBER_ARCHIVE_REASONS)[number];

export function isKKMemberArchiveReason(value: unknown): value is KKMemberArchiveReason {
  return KK_MEMBER_ARCHIVE_REASONS.some((reason) => reason === value);
}

export function getKKMemberArchiveReasonLabel(value?: string | null) {
  if (isKKMemberAgeOutReason(value)) {
    return "Aged Out (31+)";
  }
  return isKKMemberArchiveReason(value) ? value : "Reason not recorded";
}

export function isKKMemberAgeOutReason(value?: string | null) {
  return value === KK_MEMBER_AGE_OUT_REASON ||
    value === "AGED_OUT_31" ||
    value === "Aged Out (31+)" ||
    value === "Aged Out (Turned 31)";
}
