import { describe, expect, it } from "vitest";
import {
  ACTIVE_SKEAP_EDUCATION_LEVELS,
  SKEAP_APPLICATION_EDUCATION_LEVELS,
  SKEAP_EDUCATION_LEVELS,
  SKEAP_YEAR_LEVELS,
  getSkeapEducationLevelLabels,
  isSkeapEducationLevel,
  isEligibleSkeapApplicantYearLevel,
  isValidSkeapYearLevel,
} from "@/lib/skeap-education";

describe("SKEAP education options", () => {
  it("omits Vocational from the application form education-level choices", () => {
    expect(SKEAP_APPLICATION_EDUCATION_LEVELS).toEqual([
      "Junior High School",
      "Senior High School",
      "College",
      "Technical and Vocational (Tech-Voc)",
    ]);
  });

  it("defaults the current cycle to Junior High, Senior High, and College", () => {
    expect(ACTIVE_SKEAP_EDUCATION_LEVELS).toEqual([
      "JUNIOR_HIGH",
      "SENIOR_HIGH",
      "COLLEGE",
    ]);
    expect(getSkeapEducationLevelLabels(ACTIVE_SKEAP_EDUCATION_LEVELS)).toEqual([
      "Junior High School",
      "Senior High School",
      "College",
    ]);
  });

  it("defines the supported education levels and year-level options", () => {
    expect(SKEAP_EDUCATION_LEVELS).toEqual([
      "Junior High School",
      "Senior High School",
      "College",
      "Vocational",
      "Technical and Vocational (Tech-Voc)",
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
    expect(SKEAP_YEAR_LEVELS["Technical and Vocational (Tech-Voc)"]).toEqual([
      "New Trainee / Incoming",
      "1st Semester / Short Course (Min. 5 Months)",
      "1st–3rd Year TVET",
    ]);
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
    expect(isSkeapEducationLevel("Technical and Vocational (Tech-Voc)")).toBe(true);
    expect(isValidSkeapYearLevel(
      "Technical and Vocational (Tech-Voc)",
      "1st Semester / Short Course (Min. 5 Months)",
    )).toBe(true);
  });

  it("allows college applicants through sixth year", () => {
    expect(isEligibleSkeapApplicantYearLevel("College", "Incoming Freshman")).toBe(true);
    expect(isEligibleSkeapApplicantYearLevel("College", "3rd Year")).toBe(true);
    expect(isEligibleSkeapApplicantYearLevel("College", "4th Year")).toBe(true);
    expect(isEligibleSkeapApplicantYearLevel("College", "5th Year")).toBe(true);
    expect(isEligibleSkeapApplicantYearLevel("College", "6th Year")).toBe(true);
    expect(isEligibleSkeapApplicantYearLevel("College", "Grade 12")).toBe(false);
  });
});
