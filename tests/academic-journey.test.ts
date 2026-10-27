import { describe, expect, it } from "vitest";
import {
  getAcademicJourneyProgress,
  getAcademicJourneyTerms,
  getApprovedSemesterCount,
  normalizeAcademicJourneyStepStatus,
  resolveScheduledJourneyStepStatus,
} from "@/lib/academic-journey";

describe("getAcademicJourneyTerms", () => {
  it("creates two semesters for every requested year", () => {
    expect(getAcademicJourneyTerms(2)).toHaveLength(4);
    expect(getAcademicJourneyTerms(6)).toHaveLength(12);
    expect(getAcademicJourneyTerms(6).at(-1)?.label).toBe("Y6 S2");
  });
});

describe("normalizeAcademicJourneyStepStatus", () => {
  it("supports legacy values and safely handles unknown statuses", () => {
    expect(normalizeAcademicJourneyStepStatus("LOCKED")).toBe("locked");
    expect(normalizeAcademicJourneyStepStatus("pending_docs")).toBe("open_for_submit");
    expect(normalizeAcademicJourneyStepStatus("pending_submission")).toBe("open_for_submit");
    expect(normalizeAcademicJourneyStepStatus("approved")).toBe("validated");
    expect(normalizeAcademicJourneyStepStatus("RETURNED_FOR_EDIT")).toBe("action_required");
    expect(normalizeAcademicJourneyStepStatus("unknown")).toBe("scheduled_locked");
  });
});

describe("resolveScheduledJourneyStepStatus", () => {
  const schedule = {
    opensAt: new Date("2026-12-15T00:00:00.000Z"),
    closesAt: new Date("2027-01-15T00:00:00.000Z"),
  };

  it("locks submission until its scheduled opening", () => {
    expect(resolveScheduledJourneyStepStatus(
      "open_for_submit",
      schedule,
      new Date("2026-12-14T23:59:59.000Z"),
    )).toBe("scheduled_locked");
  });

  it("allows submission only while the scheduled window is open", () => {
    expect(resolveScheduledJourneyStepStatus(
      "open_for_submit",
      schedule,
      new Date("2026-12-15T00:00:00.000Z"),
    )).toBe("open_for_submit");
    expect(resolveScheduledJourneyStepStatus(
      "open_for_submit",
      schedule,
      new Date("2027-01-15T00:00:01.000Z"),
    )).toBe("scheduled_locked");
  });

  it("does not override submitted or validated states with schedule locks", () => {
    expect(resolveScheduledJourneyStepStatus("under_review", null)).toBe("under_review");
    expect(resolveScheduledJourneyStepStatus("validated", null)).toBe("validated");
    expect(resolveScheduledJourneyStepStatus("open_for_submit", null)).toBe("scheduled_locked");
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

describe("getAcademicJourneyProgress", () => {
  it("tracks the current semester independently from validated semesters", () => {
    expect(getAcademicJourneyProgress([
      { semester: "2024-2025 First Semester", status: "APPROVED" },
      { semester: "2024-2025 Second Semester", status: "PENDING" },
      { semester: "2025-2026 First Semester", status: "APPROVED" },
    ], new Date(2024, 6, 1), new Date(2025, 9, 1))).toEqual({
      currentSemesterIndex: 2,
      currentStepSemester: "2025-2026 First Semester",
      validatedSemesterIndexes: [0, 2],
      currentStepStatus: "validated",
    });
  });

  it("uses the scheduled active semester as the journey target", () => {
    const progress = getAcademicJourneyProgress(
      [],
      new Date(2025, 6, 1),
      new Date(2025, 6, 1),
      4,
      "2025-2026 Second Semester",
    );

    expect(progress.currentSemesterIndex).toBe(1);
    expect(progress.currentStepSemester).toBe("2025-2026 Second Semester");
  });

  it("distinguishes unsubmitted, under-review, correction, and validated steps", () => {
    const dateEnrolled = new Date(2025, 6, 1);
    const now = new Date(2025, 6, 1);

    expect(getAcademicJourneyProgress([], dateEnrolled, now).currentStepStatus).toBe("open_for_submit");
    expect(getAcademicJourneyProgress([
      { semester: "2025-2026 First Semester", status: "PENDING" },
    ], dateEnrolled, now).currentStepStatus).toBe("under_review");
    expect(getAcademicJourneyProgress([
      { semester: "2025-2026 First Semester", status: "RETURNED_FOR_EDIT" },
    ], dateEnrolled, now).currentStepStatus).toBe("action_required");
    expect(getAcademicJourneyProgress([
      { semester: "2025-2026 First Semester", status: "APPROVED" },
    ], dateEnrolled, now).currentStepStatus).toBe("validated");
  });
});
