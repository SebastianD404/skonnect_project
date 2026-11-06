import { describe, expect, it } from "vitest";
import {
  ACADEMIC_JOURNEY_END_OPTIONS,
  ACADEMIC_JOURNEY_START_OPTIONS,
  getAcademicJourneyLabels,
  getAcademicJourneyProgress,
  getAcademicJourneyTerms,
  getApprovedSemesterCount,
  isValidAcademicJourneyRange,
  normalizeAcademicJourneyStepStatus,
  resolveScheduledJourneyStepStatus,
} from "@/lib/academic-journey";

describe("academic journey configuration", () => {
  it("allows high-school journeys to continue through college graduation", () => {
    expect(isValidAcademicJourneyRange("college-3", "college-4")).toBe(true);
    expect(isValidAcademicJourneyRange("grade-12", "grade-7")).toBe(false);
    expect(isValidAcademicJourneyRange("grade-11", "college-4")).toBe(true);
    expect(isValidAcademicJourneyRange("grade-7", "college-5")).toBe(true);
    expect(isValidAcademicJourneyRange("college-4", "college-3")).toBe(false);
    expect(isValidAcademicJourneyRange("other-1", "other-2")).toBe(false);
  });

  it("only offers grade-school and college journey points", () => {
    expect(ACADEMIC_JOURNEY_START_OPTIONS.every(({ value }) => !value.startsWith("vocational-"))).toBe(true);
    expect(ACADEMIC_JOURNEY_END_OPTIONS.every(({ value }) => !value.startsWith("vocational-"))).toBe(true);
    expect(ACADEMIC_JOURNEY_START_OPTIONS.map(({ value }) => value)).toEqual([
      "grade-7", "grade-8", "grade-9", "grade-10", "grade-11", "grade-12",
      "college-1", "college-2", "college-3",
    ]);
    expect(ACADEMIC_JOURNEY_END_OPTIONS.map(({ value }) => value)).toEqual(["college-4", "college-5"]);
  });

  it("generates every semester between the selected college years", () => {
    expect(getAcademicJourneyLabels("college-3", "college-4")).toEqual([
      "Y3 S1", "Y3 S2", "Y4 S1", "Y4 S2",
    ]);
  });

  it("labels the transition from high school through college", () => {
    expect(getAcademicJourneyLabels("grade-11", "college-4")).toEqual([
      "G11 S1", "G11 S2", "G12 S1", "G12 S2",
      "Y1 S1", "Y1 S2", "Y2 S1", "Y2 S2",
      "Y3 S1", "Y3 S2", "Y4 S1", "Y4 S2",
    ]);
  });

  it("can still display journeys saved with the previous Grade 12 target", () => {
    expect(getAcademicJourneyLabels("grade-11", "grade-12")).toEqual([
      "G11 S1", "G11 S2", "G12 S1", "G12 S2",
    ]);
  });

  it("generates all 20 sequential semesters from Grade 7 through 4th year college", () => {
    expect(getAcademicJourneyLabels("grade-7", "college-4")).toEqual([
      "G7 S1", "G7 S2", "G8 S1", "G8 S2", "G9 S1", "G9 S2",
      "G10 S1", "G10 S2", "G11 S1", "G11 S2", "G12 S1", "G12 S2",
      "Y1 S1", "Y1 S2", "Y2 S1", "Y2 S2", "Y3 S1", "Y3 S2",
      "Y4 S1", "Y4 S2",
    ]);
  });
});

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
