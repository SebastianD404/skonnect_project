import { describe, expect, it } from "vitest";
import {
  SKEAP_EDUCATION_LEVELS,
  SKEAP_YEAR_LEVELS,
  isSkeapEducationLevel,
  isValidSkeapYearLevel,
} from "@/lib/skeap-education";

describe("SKEAP education options", () => {
  it("defines the supported education levels and year-level options", () => {
    expect(SKEAP_EDUCATION_LEVELS).toEqual([
      "Junior High School",
      "Senior High School",
      "College",
      "Vocational",
    ]);
    expect(SKEAP_YEAR_LEVELS["Junior High School"]).toEqual([
      "Grade 7",
      "Grade 8",
      "Grade 9",
      "Grade 10",
    ]);
    expect(SKEAP_YEAR_LEVELS["Senior High School"]).toEqual(["Grade 11", "Grade 12"]);
    expect(SKEAP_YEAR_LEVELS.College).toEqual([
      "Incoming Freshman",
      "1st Year",
      "2nd Year",
      "3rd Year",
      "4th Year",
      "5th Year",
      "6th Year",
    ]);
    expect(SKEAP_YEAR_LEVELS.Vocational).toEqual(SKEAP_YEAR_LEVELS.College);
  });

  it("validates education and year-level combinations", () => {
    expect(isSkeapEducationLevel("College")).toBe(true);
    expect(isSkeapEducationLevel("Elementary")).toBe(false);
    expect(isValidSkeapYearLevel("Junior High School", "Grade 7")).toBe(true);
    expect(isValidSkeapYearLevel("Junior High School", "Grade 8")).toBe(true);
    expect(isValidSkeapYearLevel("Junior High School", "Grade 9")).toBe(true);
    expect(isValidSkeapYearLevel("Senior High School", "Grade 12")).toBe(true);
    expect(isValidSkeapYearLevel("College", "Grade 12")).toBe(false);
    expect(isValidSkeapYearLevel("Senior High School", "Grade 7")).toBe(false);
    expect(isValidSkeapYearLevel("Vocational", "4th Year")).toBe(true);
  });
});
