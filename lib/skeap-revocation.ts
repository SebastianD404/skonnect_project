export const SKEAP_REVOCATION_REASONS = [
  "Tampered or falsified required documents",
  "Mentally unfit to continue studies",
  "Committed acts unbecoming of a student",
  "Failed to maintain the minimum grade of 80",
  "Dropped, shifted, or transferred without informing the SK",
  "Failed to register as a voter upon reaching voting age",
  "Became a scholarship grantee to another agency",
] as const;

export type SkeapRevocationReason = (typeof SKEAP_REVOCATION_REASONS)[number];

export function isSkeapRevocationReason(value: string): value is SkeapRevocationReason {
  return (SKEAP_REVOCATION_REASONS as readonly string[]).includes(value);
}
