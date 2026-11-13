export const KK_MEMBER_AGE_OUT_REASON = "Aged Out (31+)" as const;

export const KK_MEMBER_AGE_OUT_NOTICE_MESSAGE =
  "Your KK youth profile has been archived because you turned 31, above the KK age limit of 30. Any active or probationary SKEAP grantee status has also been removed. Your SKonnect login remains active. If your recorded birth date is wrong or you believe this is a mistake, contact Barangay Pico SK officials to request a profile review.";

export const KK_MEMBER_ARCHIVE_REASONS = [
  KK_MEMBER_AGE_OUT_REASON,
  "Transferred Residence",
  "Deceased",
  "Duplicate Record",
] as const;

export type KKMemberArchiveReason = (typeof KK_MEMBER_ARCHIVE_REASONS)[number];

export function isKKMemberArchiveReason(value: unknown): value is KKMemberArchiveReason {
  return KK_MEMBER_ARCHIVE_REASONS.some((reason) => reason === value);
}

export function getKKMemberArchiveReasonLabel(value?: string | null) {
  if (value === "Aged Out (Turned 31)") return "Aged Out (31+)";
  return isKKMemberArchiveReason(value) ? value : "Reason not recorded";
}
