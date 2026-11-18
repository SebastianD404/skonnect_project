import { describe, expect, it } from "vitest";
import { getAgeOutCutoffDate, getExactAge } from "@/lib/skeap-age";

describe("SKEAP exact age calculation", () => {
  const today = new Date("2026-06-15T12:00:00.000Z");

  it("does not age an applicant until their birthday", () => {
    expect(getExactAge(new Date("1996-06-16T00:00:00.000Z"), today)).toBe(29);
    expect(getExactAge(new Date("1996-06-15T00:00:00.000Z"), today)).toBe(30);
  });

  it("returns null when the birth date is unavailable", () => {
    expect(getExactAge(null, today)).toBeNull();
  });

  it("uses the Philippine calendar date at the birthday boundary", () => {
    const birthDate = new Date("1995-01-02T00:00:00.000Z");

    expect(getExactAge(birthDate, new Date("2026-01-01T15:59:59.000Z"))).toBe(30);
    expect(getExactAge(birthDate, new Date("2026-01-01T16:00:00.000Z"))).toBe(31);
    expect(getAgeOutCutoffDate(new Date("2026-01-01T15:59:59.000Z"))).toEqual(
      new Date("1995-01-01T00:00:00.000Z"),
    );
    expect(getAgeOutCutoffDate(new Date("2026-01-01T16:00:00.000Z"))).toEqual(
      new Date("1995-01-02T00:00:00.000Z"),
    );
  });
});
