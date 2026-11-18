import { describe, expect, it } from "vitest";
import { getKKYouthAgeGroup } from "@/lib/kk-youth-age";

describe("KK youth age groups", () => {
  it.each([
    [14, "Below KK age range"],
    [15, "15–17: Child Youth"],
    [17, "15–17: Child Youth"],
    [18, "18–24: Core Youth"],
    [24, "18–24: Core Youth"],
    [25, "25–30: Young Adult"],
    [30, "25–30: Young Adult"],
    [31, "Aged Out (31+)"],
  ])("maps age %i to its KK age group", (age, expected) => {
    expect(getKKYouthAgeGroup(age)).toBe(expected);
  });

  it("rejects fractional and negative ages", () => {
    expect(getKKYouthAgeGroup(-1)).toBeNull();
    expect(getKKYouthAgeGroup(30.5)).toBeNull();
  });
});
