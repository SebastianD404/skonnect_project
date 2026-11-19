import { describe, expect, it } from "vitest";
import {
  ACADEMIC_JOURNEY_END_OPTIONS,
  ACADEMIC_JOURNEY_START_OPTIONS,
  getAcademicJourneyGraduationYear,
  getAcademicJourneyLabels,
  getAcademicJourneyProgress,
  getAcademicJourneyTerms,
  getApprovedSemesterCount,
  isValidAcademicJourneyRange,
  mapSkeapYearLevelToStartingPoint,
  normalizeAcademicJourneyStepStatus,
  resolveScheduledJourneyStepStatus,
} from "@/lib/academic-journey";
import { getGranteeGraduationProgress } from "@/lib/grantee-graduation-readiness";

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
      "college-1", "college-2", "college-3", "college-4", "college-5",
    ]);
    expect(ACADEMIC_JOURNEY_END_OPTIONS.map(({ value }) => value)).toEqual(["college-4", "college-5"]);
  });

  it("generates every semester between the selected college years", () => {
    expect(getAcademicJourneyLabels("college-3", "college-4")).toEqual([
      "Y3 S1", "Y3 S2", "Y4 S1", "Y4 S2",
    ]);
  });

  it("supports fifth-year graduation targets without truncating the sequence", () => {
    expect(getAcademicJourneyLabels("college-3", "college-5")).toEqual([
      "Y3 S1", "Y3 S2", "Y4 S1", "Y4 S2", "Y5 S1", "Y5 S2",
    ]);
    expect(getAcademicJourneyGraduationYear("college-5")).toBe(5);
  });

  it("maps SKEAP year levels to their matching starting-point labels", () => {
    const mappings = [
      ["Grade 11", "Grade 11"],
      ["Grade 12", "Grade 12"],
      ["Incoming Freshman", "1st Year College"],
      ["1st Year", "1st Year College"],
      ["2nd Year", "2nd Year College"],
      ["3rd Year", "3rd Year College"],
      ["4th Year", "4th Year College"],
      ["5th Year", "5th Year College"],
    ] as const;

    for (const [yearLevel, startingPoint] of mappings) {
      expect(mapSkeapYearLevelToStartingPoint(yearLevel)).toBe(startingPoint);
    }
    expect(mapSkeapYearLevelToStartingPoint("6th Year")).toBeNull();
    expect(mapSkeapYearLevelToStartingPoint(null)).toBeNull();
  });

  it("labels the transition from high school through college", () => {
    expect(getAcademicJourneyLabels("grade-11", "college-4")).toEqual([
      "G11 S1", "G11 S2", "G12 S1", "G12 S2",
      "Y1 S1", "Y1 S2", "Y2 S1", "Y2 S2",
      "Y3 S1", "Y3 S2", "Y4 S1", "Y4 S2",
    ]);
  });

  it("generates twelve milestones from Grade 12 through fifth-year college", () => {
    expect(getAcademicJourneyLabels("grade-12", "college-5")).toEqual([
      "G12 S1", "G12 S2", "Y1 S1", "Y1 S2", "Y2 S1", "Y2 S2",
      "Y3 S1", "Y3 S2", "Y4 S1", "Y4 S2", "Y5 S1", "Y5 S2",
    ]);

    const progress = getGranteeGraduationProgress({
      submissions: [],
      dateEnrolled: new Date("2026-08-01T00:00:00.000Z"),
      yearLevel: "3rd Year",
      totalYears: 4,
      journeyStart: "grade-12",
      journeyEnd: "college-5",
      entryTerm: "2026-2027 First Semester",
      now: new Date("2026-11-17T05:00:00.000Z"),
    });

    expect(progress).toMatchObject({
      currentSemesterIndex: 0,
      validatedSemesterIndexes: [],
      eligibleSemesterCount: 12,
      totalRequiredSemesters: 12,
    });
    expect(progress.nodes).toHaveLength(12);
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
  it("uses configured second-semester bounds for a five-node Y2 S2 through Y4 S2 journey", () => {
    const progress = getAcademicJourneyProgress(
      [],
      new Date("2026-08-01T00:00:00.000Z"),
      new Date("2026-11-17T05:00:00.000Z"),
      4,
      null,
      "2026-2027 Second Semester",
      "2nd Year",
      "college-2",
      "college-4",
      "2026-2027",
      2,
      2,
    );

    expect(progress.nodes.map(({ yearNumber, semesterNumber, semester, academicTermCaption }) => ({
      yearNumber,
      semesterNumber,
      semester,
      academicTermCaption,
    }))).toEqual([
      { yearNumber: 2, semesterNumber: 2, semester: "2026-2027 Second Semester", academicTermCaption: "2026-2027 · 2nd Sem" },
      { yearNumber: 3, semesterNumber: 1, semester: "2027-2028 First Semester", academicTermCaption: "2027-2028 · 1st Sem" },
      { yearNumber: 3, semesterNumber: 2, semester: "2027-2028 Second Semester", academicTermCaption: "2027-2028 · 2nd Sem" },
      { yearNumber: 4, semesterNumber: 1, semester: "2028-2029 First Semester", academicTermCaption: "2028-2029 · 1st Sem" },
      { yearNumber: 4, semesterNumber: 2, semester: "2028-2029 Second Semester", academicTermCaption: "2028-2029 · 2nd Sem" },
    ]);
    expect(progress.nodes).toHaveLength(5);
    expect(progress.eligibleSemesterCount).toBe(5);
  });

  it("starts a first-year second-semester admission at that intake term", () => {
    const progress = getAcademicJourneyProgress(
      [],
      new Date("2026-08-01T00:00:00.000Z"),
      new Date("2026-11-17T05:00:00.000Z"),
      4,
      null,
      "2026-2027 Second Semester",
      "1st Year",
      "college-1",
    );

    expect(progress).toMatchObject({
      currentSemesterIndex: 0,
      currentStepSemester: "2026-2027 Second Semester",
      validatedSemesterIndexes: [],
      currentStepStatus: "open_for_submit",
      eligibleSemesterCount: 7,
    });
    expect(progress.nodes[0]).toMatchObject({
      semester: "2026-2027 Second Semester",
      status: "CURRENT",
      yearNumber: 1,
      semesterNumber: 2,
    });
  });

  it("prefers the saved starting point over a stale application year level", () => {
    const progress = getAcademicJourneyProgress(
      [],
      new Date("2026-08-01T00:00:00.000Z"),
      new Date("2026-11-17T05:00:00.000Z"),
      4,
      null,
      "2026-2027 Second Semester",
      "2nd Year",
      "college-1",
    );

    expect(progress.currentSemesterIndex).toBe(0);
    expect(progress.nodes).toHaveLength(7);
    expect(progress.nodes[0]).toMatchObject({
      semester: "2026-2027 Second Semester",
      status: "CURRENT",
      yearNumber: 1,
      semesterNumber: 2,
    });
    expect(progress.eligibleSemesterCount).toBe(7);
  });

  it("creates exactly three milestones for a third-year second-semester 4-year admission", () => {
    const progress = getAcademicJourneyProgress(
      [],
      new Date("2026-08-01T00:00:00.000Z"),
      new Date("2026-11-17T05:00:00.000Z"),
      4,
      null,
      "2026-2027 Second Semester",
      "3rd Year",
      "college-3",
    );

    expect(progress.nodes.map((node) => node.semester)).toEqual([
      "2026-2027 Second Semester",
      "2027-2028 First Semester",
      "2027-2028 Second Semester",
    ]);
    expect(progress.eligibleSemesterCount).toBe(3);
  });

  it("advances the current step to the first unvalidated semester", () => {
    const progress = getAcademicJourneyProgress([
      { semester: "2024-2025 First Semester", status: "APPROVED" },
      { semester: "2024-2025 Second Semester", status: "PENDING" },
      { semester: "2025-2026 First Semester", status: "APPROVED" },
    ], new Date(2024, 6, 1), new Date(2025, 9, 1));

    expect(progress).toMatchObject({
      currentSemesterIndex: 1,
      currentStepSemester: "2024-2025 Second Semester",
      validatedSemesterIndexes: [0, 2],
      currentStepStatus: "under_review",
    });
    expect(progress.nodes.filter((node) => node.status === "VALIDATED")).toHaveLength(2);
  });

  it("keeps approved application documents without validating an unsubmitted semester", () => {
    const progress = getAcademicJourneyProgress(
      [],
      new Date(2025, 6, 1),
      new Date(2025, 6, 1),
      4,
      {
        semester: "2025-2026 First Semester",
        gwa: 1.75,
        gradeReportUrl: "/grade-report.pdf",
        coeFileUrl: "/coe.pdf",
      },
    );

    expect(progress.currentSemesterIndex).toBe(0);
    expect(progress.validatedSemesterIndexes).toEqual([]);
    expect(progress.currentStepStatus).toBe("open_for_submit");
    expect(progress.nodes[0]).toMatchObject({
      status: "CURRENT",
      isInitialGrant: true,
      gwa: 1.75,
      gradeReportUrl: "/grade-report.pdf",
      coeFileUrl: "/coe.pdf",
    });
    expect(progress.nodes[1].status).toBe("LOCKED");
  });

  it("does not validate the intake term from an approved application when there are no submissions", () => {
    const progress = getAcademicJourneyProgress(
      [],
      new Date("2026-08-01T00:00:00.000Z"),
      new Date("2026-11-17T05:00:00.000Z"),
      4,
      { semester: "2026-2027 Second Semester" },
      "2026-2027 Second Semester",
      "1st Year",
    );

    expect(progress).toMatchObject({
      currentSemesterIndex: 0,
      currentStepSemester: "2026-2027 Second Semester",
      validatedSemesterIndexes: [],
      currentStepStatus: "open_for_submit",
    });
    expect(progress.nodes[0]).toMatchObject({
      semester: "2026-2027 Second Semester",
      status: "CURRENT",
    });
  });

  it("distinguishes unsubmitted, pending, under-review, returned, and validated steps", () => {
    const dateEnrolled = new Date(2025, 6, 1);
    const now = new Date(2025, 6, 1);

    expect(getAcademicJourneyProgress([], dateEnrolled, now).currentStepStatus).toBe("open_for_submit");
    expect(getAcademicJourneyProgress([
      { semester: "2025-2026 First Semester", status: "PENDING" },
    ], dateEnrolled, now).currentStepStatus).toBe("under_review");
    expect(getAcademicJourneyProgress([
      { semester: "2025-2026 First Semester", status: "PRE_QUALIFIED" },
    ], dateEnrolled, now).nodes[0].status).toBe("UNDER_REVIEW");
    const awaitingPhysicalCtc = getAcademicJourneyProgress([
      { semester: "2025-2026 First Semester", status: "AWAITING_PHYSICAL_CTC" },
    ], dateEnrolled, now);
    expect(awaitingPhysicalCtc.nodes[0].status).toBe("UNDER_REVIEW");
    expect(awaitingPhysicalCtc.validatedSemesterIndexes).toEqual([]);
    expect(getAcademicJourneyProgress([
      { semester: "2025-2026 First Semester", status: "RETURNED_FOR_EDIT" },
    ], dateEnrolled, now).currentStepStatus).toBe("action_required");
    expect(getAcademicJourneyProgress([
      { semester: "2025-2026 First Semester", status: "APPROVED" },
    ], dateEnrolled, now).currentStepStatus).toBe("open_for_submit");
  });
});
