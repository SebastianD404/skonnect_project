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

export const PERMANENTLY_BARRED_SKEAP_REVOCATION_REASONS = [
  "TAMPERED_DOCUMENTS",
  "UNBECOMING_ACTS",
] as const;
const permanentlyBarredReasonSet = new Set<string>(PERMANENTLY_BARRED_SKEAP_REVOCATION_REASONS);

export const STANDARD_SKEAP_REVOCATION_PROOF_TYPES = [
  "Barangay Incident Report",
  "Police Report / Blotter",
  "School Disciplinary Notice",
] as const;

export const SKEAP_REVOCATION_PROOF_TYPES = [
  ...STANDARD_SKEAP_REVOCATION_PROOF_TYPES,
  "Official SK Resolution",
  "Others",
] as const;

export const MAX_SKEAP_REVOCATION_PROOF_SIZE = 10 * 1024 * 1024;
export const SKEAP_REVOCATION_PROOF_BUCKET = "revocation-proofs";

export type SkeapRevocationProofOption = (typeof SKEAP_REVOCATION_PROOF_TYPES)[number];
export type SkeapRevocationProofType =
  | (typeof STANDARD_SKEAP_REVOCATION_PROOF_TYPES)[number]
  | "Official SK Resolution"
  | `Other: ${string}`;

export function isSkeapRevocationProofOption(value: string): value is SkeapRevocationProofOption {
  return SKEAP_REVOCATION_PROOF_TYPES.some((proofType) => proofType === value);
}

export function isSkeapRevocationProofType(value: string): value is SkeapRevocationProofType {
  if (value.startsWith("Other:")) {
    const specification = value.slice("Other:".length).trim();
    return specification.length >= 3 && specification.length <= 80;
  }
  return STANDARD_SKEAP_REVOCATION_PROOF_TYPES.some((proofType) => proofType === value) ||
    value === "Official SK Resolution";
}

export type SkeapRevocationReason = (typeof SKEAP_REVOCATION_REASONS)[number]["value"];

export function isSkeapRevocationReason(value: string): value is SkeapRevocationReason {
  return SKEAP_REVOCATION_REASONS.some((reason) => reason.value === value);
}

export function isSkeapReapplicationPermanentlyBarred(reasonValue: string | null | undefined) {
  const primaryReason = reasonValue?.split(/Additional Notes:/i, 1)[0].trim();
  if (!primaryReason) return false;

  const reason = SKEAP_REVOCATION_REASONS.find(
    (option) =>
      option.value === primaryReason.toUpperCase().replace(/[\s-]+/g, "_") ||
      option.label.toLowerCase() === primaryReason.toLowerCase(),
  );
  return Boolean(reason && permanentlyBarredReasonSet.has(reason.value));
}

export function getSkeapRevocationReasonLabel(value: SkeapRevocationReason): string {
  const reason = SKEAP_REVOCATION_REASONS.find((option) => option.value === value);
  if (!reason) {
    throw new Error(`Unknown SKEAP revocation reason: ${value}`);
  }
  return reason.label;
}
