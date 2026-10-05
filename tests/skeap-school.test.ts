import { describe, expect, it } from "vitest";
import { normalizeSkeapSchoolName } from "@/lib/skeap-school";
import { formatSkeapPermanentAddress } from "@/lib/grantee-address";

describe("normalizeSkeapSchoolName", () => {
  it("removes KCP from the full King's College school name", () => {
    expect(normalizeSkeapSchoolName("King's College of the Philippines (KCP)"))
      .toBe("King's College of the Philippines");
  });

  describe("formatSkeapPermanentAddress", () => {
    it("removes empty address parts and orders the repeated barangay after sitio", () => {
      expect(formatSkeapPermanentAddress({}, ", Bayabas,, La Trinidad, Benguet, Pico"))
        .toBe("Bayabas, Pico, La Trinidad, Benguet");
    });

    it("does not repeat the barangay when the profile locality already includes it", () => {
      expect(formatSkeapPermanentAddress({
        sitio: "Bayabas",
        barangay: "Pico",
        addressLine: "La Trinidad, Benguet, Pico",
      })).toBe("Bayabas, Pico, La Trinidad, Benguet");
    });
  });

  it("canonicalizes the school name without KCP", () => {
    expect(normalizeSkeapSchoolName("king’s college of the philippines"))
      .toBe("King's College of the Philippines");
  });

  it("leaves other schools and unrelated text unchanged", () => {
    expect(normalizeSkeapSchoolName("Benguet State University (BSU)"))
      .toBe("Benguet State University (BSU)");
    expect(normalizeSkeapSchoolName("KCP Student ID")).toBe("KCP Student ID");
  });
});
