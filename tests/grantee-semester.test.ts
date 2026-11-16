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
) {
  return {
    id: "grantee-1",
    yearLevel: "2nd Year",
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

  it("advances Junior High requirements by one school year", async () => {
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
      schoolYear: "2027-2028",
      semester: "Annual / School Year",
      termLabel: "2027-2028 Annual / School Year",
      previousApprovedTerm: {
        schoolYear: "2026-2027",
        semester: "First Semester",
      },
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
      ]),
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

  it("derives the initial term from the approved application date", async () => {
    findFirst.mockResolvedValueOnce(activeGrantee());

    await expect(detectGranteeTargetTerm("user-1")).resolves.toMatchObject({
      termLabel: "2026-2027 Second Semester",
      detectionSummary: expect.stringContaining("approved SKEAP application"),
    });
  });
});
