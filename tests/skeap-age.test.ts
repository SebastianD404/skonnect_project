import { describe, expect, it } from "vitest";
import { getExactAge } from "@/lib/skeap-age";

describe("SKEAP exact age calculation", () => {
  const today = new Date("2026-06-15T12:00:00.000Z");

  it("does not age an applicant until their birthday", () => {
    expect(getExactAge(new Date("1996-06-16T00:00:00.000Z"), today)).toBe(29);
    expect(getExactAge(new Date("1996-06-15T00:00:00.000Z"), today)).toBe(30);
  });

  it("returns null when the birth date is unavailable", () => {
    expect(getExactAge(null, today)).toBeNull();
  });
});
