import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  userUpdate: vi.fn(),
  submissionFindFirst: vi.fn(),
  submissionCreate: vi.fn(),
  submissionUpdate: vi.fn(),
  transactionSubmissionFindFirst: vi.fn(),
  transaction: vi.fn(),
  academicTermScheduleFindMany: vi.fn(),
  detectGranteeTargetTerm: vi.fn(),
  getAcademicTermScheduleState: vi.fn(),
  processSubmissionGradeReportOcr: vi.fn(),
  after: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst: mocks.userFindFirst, update: mocks.userUpdate },
    academicTermSchedule: { findMany: mocks.academicTermScheduleFindMany },
    submission: {
      findFirst: mocks.submissionFindFirst,
      create: mocks.submissionCreate,
      update: mocks.submissionUpdate,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "auth-1", email: "grantee@example.com" } } }) },
  }),
}));

vi.mock("@/lib/grantee-profile", () => ({
  isGranteeProfileComplete: () => true,
}));

vi.mock("@/lib/ocr/process-submission", () => ({
  processSubmissionGradeReportOcr: mocks.processSubmissionGradeReportOcr,
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: mocks.after };
});

vi.mock("@/lib/semester-progress", () => ({
  getCurrentAcademicSemester: () => "2026-2027 First Semester",
  isAllowedAcademicSemester: () => true,
}));

vi.mock("@/lib/grantee-semester", () => ({
  detectGranteeTargetTerm: mocks.detectGranteeTargetTerm,
  getScheduleSemesterForTargetTerm: () => "2026-2027 First Semester",
}));

vi.mock("@/lib/academic-term-schedule", () => ({
  getAcademicTermScheduleState: mocks.getAcademicTermScheduleState,
}));

import { NextRequest } from "next/server";
import { POST } from "../app/api/grantee/submissions/route";

function createRequest(forceSubmit = false) {
  return new NextRequest("http://localhost/api/grantee/submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      semester: "2026-2027 First Semester",
      gradeFileUrl: "grantee-submissions/auth-1/grades.pdf",
      coeFileUrl: "grantee-submissions/auth-1/coe.pdf",
      forceSubmit,
    }),
  });
}

describe("grantee requirement submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userFindFirst.mockResolvedValue({
      id: "user-1",
      authId: "auth-1",
      role: "GRANTEE",
      grantee: { id: "grantee-1", status: "ACTIVE" },
    });
    mocks.submissionFindFirst.mockResolvedValue(null);
    mocks.detectGranteeTargetTerm.mockResolvedValue({
      schoolYear: "2026-2027",
      semester: "First Semester",
      termLabel: "2026-2027 First Semester",
      isResubmission: false,
      detectionSummary: "Detected next term",
      previousApprovedTerm: null,
      hasPendingSubmission: false,
      hasApprovedSubmission: false,
    });
    mocks.getAcademicTermScheduleState.mockResolvedValue({
      schedules: [],
      window: {
        status: "OPEN",
        semester: "2026-2027 First Semester",
        opensAt: new Date(Date.now() - 60_000),
        closesAt: new Date(Date.now() + 60_000),
      },
    });
    mocks.transactionSubmissionFindFirst.mockResolvedValue(null);
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        submission: {
          findFirst: mocks.transactionSubmissionFindFirst,
          create: mocks.submissionCreate,
          update: mocks.submissionUpdate,
        },
      })
    );
    mocks.submissionCreate.mockImplementation(async ({ data }) => ({
      id: "submission-1",
      granteeId: data.granteeId,
      semester: data.semester,
      gradeFileUrl: data.gradeFileUrl,
      coeFileUrl: data.coeFileUrl,
      status: data.status,
      reviewedById: null,
      reviewNotes: data.reviewNotes,
      submittedAt: data.submittedAt,
      reviewedAt: null,
      flaggedFields: data.flaggedFields,
      coeStatus: "PENDING",
      gradesStatus: "PENDING",
      coeSubmittedAt: data.submittedAt,
      coeApprovedAt: null,
      gradesSubmittedAt: null,
      gradesApprovedAt: null,
    }));
    mocks.after.mockImplementation((callback: () => Promise<void>) => {
      void callback();
    });
  });

  it("saves a regular submission before scheduling document checks", async () => {
    mocks.processSubmissionGradeReportOcr.mockReturnValue(new Promise<void>(() => {}));

    const response = await POST(createRequest());

    expect(response.status).toBe(200);
    expect(mocks.submissionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        ocrStatus: "OCR_PENDING",
        ocrRawText: "",
        ocrGwa: null,
        ocrTotalUnits: null,
        ocrConfidence: null,
        ocrParsedRows: expect.objectContaining({
          forcedManualReview: false,
        }),
      }),
    }));
    expect(mocks.after).toHaveBeenCalledOnce();
    expect(mocks.processSubmissionGradeReportOcr).toHaveBeenCalledWith("submission-1", {
      manualReviewRequired: false,
    });
    expect(mocks.submissionCreate.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.after.mock.invocationCallOrder[0]);
  });

  it("saves a forced submission and schedules it for admin review", async () => {
    const response = await POST(createRequest(true));

    expect(response.status).toBe(200);
    expect(mocks.submissionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        ocrStatus: "OCR_PENDING",
        ocrRawText: "",
        ocrGwa: null,
        ocrTotalUnits: null,
        ocrConfidence: null,
        ocrParsedRows: {
          rows: [],
          unrecognizedRows: [],
          documentValidation: {
            certificateOfEnrollment: false,
            gradeReport: false,
          },
          forcedManualReview: true,
        },
      }),
    }));
    expect(mocks.processSubmissionGradeReportOcr).toHaveBeenCalledWith("submission-1", {
      manualReviewRequired: true,
    });
  });
});
