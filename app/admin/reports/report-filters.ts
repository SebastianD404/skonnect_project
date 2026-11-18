export const ARCHIVE_REASON_FILTER_OPTIONS = [
  { value: "all", label: "All archive reasons" },
  { value: "aged_out", label: "Aged Out (31+)" },
  { value: "transferred_residence", label: "Transferred Residence" },
  { value: "voluntary_withdrawal", label: "Voluntary Withdrawal / Opt-Out" },
  { value: "duplicate_or_invalid", label: "Duplicate or Invalid Record" },
  { value: "deceased", label: "Deceased" },
  { value: "other", label: "Other (Specify)" },
] as const;

export const ARCHIVE_REASON_FILTER_LABELS = Object.fromEntries(
  ARCHIVE_REASON_FILTER_OPTIONS.map(({ value, label }) => [value, label]),
) as Record<string, string>;
