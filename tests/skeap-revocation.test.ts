import { describe, expect, it } from "vitest";
import {
  isSkeapRevocationReason,
  SKEAP_REVOCATION_REASONS,
} from "@/lib/skeap-revocation";

describe("SKEAP revocation reasons", () => {
  it("uses the ordinance-defined options", () => {
    expect(SKEAP_REVOCATION_REASONS).toEqual([
      { value: "TAMPERED_DOCUMENTS", label: "Tampered or falsified documents" },
      { value: "MENTALLY_UNFIT", label: "Mentally unfit to continue studies" },
      { value: "UNBECOMING_ACTS", label: "Committed acts unbecoming of a student" },
      { value: "LOW_GWA", label: "Failed to maintain a minimum GWA of 80" },
      { value: "FAILED_SUBJECT", label: "Failed a subject (Grade below 75 or 5.0)" },
      { value: "DROPPED_SHIFTED", label: "Dropped, shifted, or transferred without SK notice" },
      { value: "NOT_REGISTERED_VOTER", label: "Failed to register as a voter at voting age" },
      { value: "OTHER_SCHOLARSHIP", label: "Became a grantee of another scholarship agency" },
    ]);
  });

  it("accepts enum keys and rejects labels and unknown values", () => {
    expect(isSkeapRevocationReason(SKEAP_REVOCATION_REASONS[0].value)).toBe(true);
    expect(isSkeapRevocationReason(SKEAP_REVOCATION_REASONS[0].label)).toBe(false);
    expect(isSkeapRevocationReason("Failed two subjects")).toBe(false);
  });
});
