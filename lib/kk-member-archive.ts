export const KK_MEMBER_ARCHIVE_REASONS = [
  "Aged Out (31+)",
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
