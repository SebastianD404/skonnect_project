import { describe, expect, it } from "vitest";
import {
  isSkeapRevocationReason,
  SKEAP_REVOCATION_REASONS,
} from "@/lib/skeap-revocation";

describe("SKEAP revocation reasons", () => {
  it("uses the ordinance-defined options", () => {
    expect(SKEAP_REVOCATION_REASONS).toEqual([
      "Tampered or falsified required documents",
      "Mentally unfit to continue studies",
      "Committed acts unbecoming of a student",
      "Failed to maintain the minimum grade of 80",
      "Dropped, shifted, or transferred without informing the SK",
      "Failed to register as a voter upon reaching voting age",
      "Became a scholarship grantee to another agency",
    ]);
  });

  it("rejects reasons outside the standardized list", () => {
    expect(isSkeapRevocationReason(SKEAP_REVOCATION_REASONS[0])).toBe(true);
    expect(isSkeapRevocationReason("Failed two subjects")).toBe(false);
  });
});
