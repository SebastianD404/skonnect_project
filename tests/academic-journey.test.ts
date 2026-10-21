import { describe, expect, it } from "vitest";
import { getAcademicJourneyTerms, getApprovedSemesterCount } from "@/lib/academic-journey";

describe("getAcademicJourneyTerms", () => {
  it("creates two semesters for every requested year", () => {
    expect(getAcademicJourneyTerms(2)).toHaveLength(4);
    expect(getAcademicJourneyTerms(6)).toHaveLength(12);
    expect(getAcademicJourneyTerms(6).at(-1)?.label).toBe("Y6 S2");
  });
});

describe("getApprovedSemesterCount", () => {
  it("counts distinct approved semesters only", () => {
    expect(getApprovedSemesterCount([
      { semester: "2025-2026 First Semester", status: "APPROVED" },
      { semester: "2025-2026 First Semester", status: "APPROVED" },
      { semester: "2025-2026 Second Semester", status: "PENDING" },
      { semester: "2025-2026 Second Semester", status: "APPROVED" },
    ])).toBe(2);
  });

  it("ignores unapproved records and caps progress at eight semesters", () => {
    expect(getApprovedSemesterCount([
      { semester: "2021-2022 First Semester", status: "PENDING" },
      ...Array.from({ length: 9 }, (_, index) => ({
        semester: `20${22 + index}-${23 + index} First Semester`,
        status: "APPROVED",
      })),
    ])).toBe(8);
  });

  it("returns zero when there are no approved semesters", () => {
    expect(getApprovedSemesterCount([])).toBe(0);
  });
});
