import { describe, expect, it } from "vitest";
import { getGranteeGraduationProgress } from "@/lib/grantee-graduation-readiness";

describe("getGranteeGraduationProgress", () => {
  const dateEnrolled = new Date(2022, 6, 1);
  const now = new Date(2026, 6, 1);

  it("recognizes all eight validated terms for a four-year journey", () => {
    const submissions = Array.from({ length: 8 }, (_, index) => ({
      semester: `${2022 + Math.floor(index / 2)}-${2023 + Math.floor(index / 2)} ${
        index % 2 === 0 ? "First" : "Second"
      } Semester`,
      status: "APPROVED",
    }));

    expect(getGranteeGraduationProgress({
      submissions,
      dateEnrolled,
      journeyStart: "college-1",
      journeyEnd: "college-4",
      now,
    })).toMatchObject({
      totalRequiredSemesters: 8,
      validatedCount: 8,
      isComplete: true,
    });
  });

  it("requires every term in a two-year journey", () => {
    const submissions = Array.from({ length: 4 }, (_, index) => ({
      semester: `${2022 + Math.floor(index / 2)}-${2023 + Math.floor(index / 2)} ${
        index % 2 === 0 ? "First" : "Second"
      } Semester`,
      status: "APPROVED",
    }));

    expect(getGranteeGraduationProgress({
      submissions: submissions.slice(0, 3),
      dateEnrolled,
      journeyStart: "college-1",
      journeyEnd: "college-2",
      now,
    })).toMatchObject({
      totalRequiredSemesters: 4,
      validatedCount: 3,
      isComplete: false,
    });
    expect(getGranteeGraduationProgress({
      submissions,
      dateEnrolled,
      journeyStart: "college-1",
      journeyEnd: "college-2",
      now,
    }).isComplete).toBe(true);
  });

  it("uses a fifth-year target for a third-year second-semester intake", () => {
    const progress = getGranteeGraduationProgress({
      submissions: [],
      dateEnrolled,
      yearLevel: "3rd Year",
      totalYears: 4,
      journeyStart: "college-3",
      journeyEnd: "college-5",
      entryTerm: "2026-2027 Second Semester",
      now,
    });

    expect(progress.nodes.map((node) => node.semester)).toEqual([
      "2026-2027 Second Semester",
      "2027-2028 First Semester",
      "2027-2028 Second Semester",
      "2028-2029 First Semester",
      "2028-2029 Second Semester",
    ]);
    expect(progress.totalRequiredSemesters).toBe(5);
    expect(progress.currentSemesterIndex).toBe(0);
    expect(progress.isComplete).toBe(false);
  });
});
