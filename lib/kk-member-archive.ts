export const KK_MEMBER_AGE_OUT_REASON = "AGED_OUT" as const;
export const KK_MEMBER_MANUAL_AGE_OUT_REASON = "Aged out (31+ years old - RA 10742)" as const;
export const KK_MEMBER_AGE_OUT_SCHOLAR_REMARK = "Aged Out / Concluded (31+ years old - RA 10742)" as const;

export const KK_MEMBER_AGE_OUT_NOTICE_MESSAGE =
  "Your KK youth profile has been archived because you reached age 31, above the KK age limit of 30. Any pending or waitlisted SKEAP application has been closed. Active scholarship records are managed separately in Active Grantees. Your SKonnect login remains active. If your recorded birth date is wrong or you believe this is a mistake, contact Barangay Pico SK officials to request a profile review.";

export const KK_MEMBER_ARCHIVE_REASONS = [
  "Transferred Residence",
  "Voluntary Withdrawal / Opt-Out",
  "Duplicate or Invalid Record",
  "Deceased",
  "Other (Specify)",
] as const;

const KK_MEMBER_SELECTABLE_ARCHIVE_REASONS = [
  "Transferred Residence",
  "Voluntary Withdrawal / Opt-Out",
  "Duplicate or Invalid Record",
  "Deceased",
] as const;

const KK_MEMBER_STORED_ARCHIVE_REASONS = [
  ...KK_MEMBER_SELECTABLE_ARCHIVE_REASONS,
  "Duplicate Record",
] as const;

export type KKMemberArchiveReasonOption = (typeof KK_MEMBER_ARCHIVE_REASONS)[number];
export type KKMemberArchiveReason =
  | (typeof KK_MEMBER_STORED_ARCHIVE_REASONS)[number]
  | `Other: ${string}`;

export function resolveKKMemberArchiveReason(
  selection: unknown,
  customReason: unknown,
): KKMemberArchiveReason | null {
  if (selection === "Other (Specify)") {
    if (typeof customReason !== "string" || customReason.length > 120) return null;
    const trimmedReason = customReason.trim();
    return trimmedReason && trimmedReason.length <= 120
      ? `Other: ${trimmedReason}`
      : null;
  }

  return KK_MEMBER_SELECTABLE_ARCHIVE_REASONS.find((reason) => reason === selection) ?? null;
}

export function isKKMemberArchiveReason(value: unknown): value is KKMemberArchiveReason {
  if (KK_MEMBER_STORED_ARCHIVE_REASONS.some((reason) => reason === value)) return true;
  return (
    typeof value === "string" &&
    value.startsWith("Other: ") &&
    value.slice("Other: ".length).trim().length > 0 &&
    value.slice("Other: ".length).trim().length <= 120
  );
}

export function getKKMemberArchiveReasonLabel(value?: string | null) {
  if (isKKMemberAgeOutReason(value)) {
    return "Aged Out (31+)";
  }
  return isKKMemberArchiveReason(value) ? value : "Reason not recorded";
}

export function isKKMemberAgeOutReason(value?: string | null) {
  const reason = value?.trim().toLowerCase();
  return reason === KK_MEMBER_AGE_OUT_REASON.toLowerCase() ||
    reason === KK_MEMBER_MANUAL_AGE_OUT_REASON.toLowerCase() ||
    reason === "aged_out_31" ||
    reason === "aged out (31+)" ||
    reason === "aged out (turned 31)";
}
