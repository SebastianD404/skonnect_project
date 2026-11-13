export const SKEAP_REVOCATION_REASONS = [
  { value: "TAMPERED_DOCUMENTS", label: "Tampered or falsified documents" },
  { value: "MENTALLY_UNFIT", label: "Mentally unfit to continue studies" },
  { value: "UNBECOMING_ACTS", label: "Committed acts unbecoming of a student" },
  { value: "LOW_GWA", label: "Failed to maintain a minimum GWA of 80" },
  { value: "FAILED_SUBJECT", label: "Failed a subject (Grade below 75 or 5.0)" },
  { value: "DROPPED_SHIFTED", label: "Dropped, shifted, or transferred without SK notice" },
  { value: "NOT_REGISTERED_VOTER", label: "Failed to register as a voter at voting age" },
  { value: "OTHER_SCHOLARSHIP", label: "Became a grantee of another scholarship agency" },
] as const;

export type SkeapRevocationReason = (typeof SKEAP_REVOCATION_REASONS)[number]["value"];

export function isSkeapRevocationReason(value: string): value is SkeapRevocationReason {
  return SKEAP_REVOCATION_REASONS.some((reason) => reason.value === value);
}

export function getSkeapRevocationReasonLabel(value: SkeapRevocationReason): string {
  const reason = SKEAP_REVOCATION_REASONS.find((option) => option.value === value);
  if (!reason) {
    throw new Error(`Unknown SKEAP revocation reason: ${value}`);
  }
  return reason.label;
}
