import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst } = vi.hoisted(() => ({
  findFirst: vi.fn(),
}));

vi.mock("../lib/prisma", () => ({
  prisma: {
    grantee: { findFirst },
  },
}));

import {
  detectGranteeTargetTerm,
  getScheduleSemesterForTargetTerm,
  resolveGranteeAcademicTimeline,
  resolveGranteeEntryTerm,
} from "../lib/grantee-semester";

const approvedApplication = {
  educationLevel: "College",
  submittedAt: new Date("2026-08-12T00:00:00.000Z"),
};

function activeGrantee(
  submissions: Array<{
    semester: string;
    status: string;
    submittedAt: Date;
    reviewedById?: string | null;
    reviewedAt?: Date | null;
  }> = [],
  educationLevel = "College",
  entrySemester = "First Semester",
) {
  return {
    id: "grantee-1",
    yearLevel: "2nd Year",
    entryAcademicYear: "2026-2027",
    entrySemester,
    dateEnrolled: new Date("2026-08-12T00:00:00.000Z"),
    user: {
      skeapApplications: [{ ...approvedApplication, educationLevel }],
    },
    submissions,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("detectGranteeTargetTerm", () => {
  it("maps annual Junior High targets to the school year's First Semester schedule", () => {
    expect(
      getScheduleSemesterForTargetTerm({
        schoolYear: "2027-2028",
        semester: "Annual / School Year",
      }),
    ).toBe("2027-2028 First Semester");
  });

  it("advances Junior High grantees to the next sequential semester after approval", async () => {
    findFirst.mockResolvedValueOnce(
      activeGrantee([
        {
          semester: "2026-2027 First Semester",
          status: "APPROVED",
          submittedAt: new Date("2026-09-10T00:00:00.000Z"),
        },
      ], "Junior High School"),
    );

    await expect(detectGranteeTargetTerm("user-1")).resolves.toMatchObject({
      schoolYear: "2026-2027",
      semester: "Second Semester",
      termLabel: "2026-2027 Second Semester",
    });
  });

  it("advances semester-based programs within or across school years", async () => {
    findFirst.mockResolvedValueOnce(
      activeGrantee([
        {
          semester: "2026-2027 First Semester",
          status: "APPROVED",
          submittedAt: new Date("2026-09-10T00:00:00.000Z"),
        },
      ]),
    );

    await expect(detectGranteeTargetTerm("user-1")).resolves.toMatchObject({
      termLabel: "2026-2027 Second Semester",
    });

    findFirst.mockResolvedValueOnce(
      activeGrantee([
        {
          semester: "2026-2027 Second Semester",
          status: "APPROVED",
          submittedAt: new Date("2027-02-10T00:00:00.000Z"),
        },
      ], "College", "Second Semester"),
    );
    await expect(detectGranteeTargetTerm("user-1")).resolves.toMatchObject({
      termLabel: "2027-2028 First Semester",
    });
  });

  it("returns an exact returned term and flags an existing pending target term", async () => {
    findFirst.mockResolvedValueOnce(
      activeGrantee([
        {
          semester: "2026-2027 First Semester",
          status: "APPROVED",
          submittedAt: new Date("2026-09-10T00:00:00.000Z"),
        },
        {
          semester: "2026-2027 Second Semester",
          status: "RETURNED_FOR_EDIT",
          submittedAt: new Date("2027-02-10T00:00:00.000Z"),
        },
      ]),
    );
    await expect(detectGranteeTargetTerm("user-1")).resolves.toMatchObject({
      termLabel: "2026-2027 Second Semester",
      isResubmission: true,
      reason: "Resubmitting returned requirements for 2026-2027 Second Semester",
    });

    findFirst.mockResolvedValueOnce(
      activeGrantee([
        {
          semester: "2026-2027 First Semester",
          status: "APPROVED",
          submittedAt: new Date("2026-09-10T00:00:00.000Z"),
        },
        {
          semester: "2026-2027 Second Semester",
          status: "PENDING",
          submittedAt: new Date("2027-02-10T00:00:00.000Z"),
        },
      ]),
    );
    await expect(detectGranteeTargetTerm("user-1")).resolves.toMatchObject({
      termLabel: "2026-2027 Second Semester",
      hasPendingSubmission: true,
      canReplacePendingSubmission: true,
    });

    findFirst.mockResolvedValueOnce(
      activeGrantee([
        {
          semester: "2026-2027 First Semester",
          status: "APPROVED",
          submittedAt: new Date("2026-09-10T00:00:00.000Z"),
        },
        {
          semester: "2026-2027 Second Semester",
          status: "PENDING",
          submittedAt: new Date("2027-02-10T00:00:00.000Z"),
          reviewedById: "admin-1",
          reviewedAt: new Date("2027-02-11T00:00:00.000Z"),
        },
      ]),
    );
    await expect(detectGranteeTargetTerm("user-1")).resolves.toMatchObject({
      termLabel: "2026-2027 Second Semester",
      hasPendingSubmission: true,
      canReplacePendingSubmission: false,
    });
  });

  it("uses the stored entry term when there are no approved submissions", async () => {
    findFirst.mockResolvedValueOnce(activeGrantee());

    await expect(detectGranteeTargetTerm("user-1")).resolves.toMatchObject({
      termLabel: "2026-2027 First Semester",
      detectionSummary: expect.stringContaining("entry term"),
    });
  });
});

describe("resolveGranteeEntryTerm", () => {
  it("uses the currently open Admin Settings term instead of an upcoming semester", () => {
    const now = new Date("2026-11-17T05:00:00.000Z");
    expect(resolveGranteeEntryTerm([
      {
        id: "second-semester",
        semester: "2026-2027 Second Semester",
        opensAt: new Date("2026-11-01T00:00:00.000Z"),
        closesAt: new Date("2027-04-30T00:00:00.000Z"),
      },
      {
        id: "next-first-semester",
        semester: "2027-2028 First Semester",
        opensAt: new Date("2027-06-01T00:00:00.000Z"),
        closesAt: new Date("2027-10-31T00:00:00.000Z"),
      },
    ], now)).toMatchObject({
      schoolYear: "2026-2027",
      semester: "Second Semester",
      termLabel: "2026-2027 Second Semester",
    });
  });
});

describe("resolveGranteeAcademicTimeline", () => {
  it("starts at the stored term with zero validated semesters and advances only after approval", () => {
    const grantee = {
      entryAcademicYear: "2026-2027",
      entrySemester: "Second Semester",
      dateEnrolled: new Date("2026-11-01T00:00:00.000Z"),
      journeyStart: null,
      journeyEnd: null,
    };
    const activeSettings = { schedules: [], now: new Date("2026-11-17T05:00:00.000Z") };

    const initialTimeline = resolveGranteeAcademicTimeline(grantee, [], activeSettings);
    expect(initialTimeline.targetTerm.termLabel).toBe("2026-2027 Second Semester");
    expect(initialTimeline.journeyProgress).toMatchObject({
      currentSemesterIndex: 0,
      currentStepSemester: "2026-2027 Second Semester",
      validatedCount: 0,
    });
    expect(initialTimeline.journeyProgress.nodes[0].status).toBe("CURRENT");

    const approvedTimeline = resolveGranteeAcademicTimeline(grantee, [
      {
        semester: "2026-2027 Second Semester",
        status: "APPROVED",
        submittedAt: new Date("2027-02-01T00:00:00.000Z"),
      },
    ], activeSettings);
    expect(approvedTimeline.targetTerm.termLabel).toBe("2027-2028 First Semester");
    expect(approvedTimeline.journeyProgress.validatedCount).toBe(1);
  });
});
