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
});
