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

function createRequest(
  forceSubmit = false,
  gradeDiagnostics?: {
    detectedScale: "PERCENTAGE_100" | "SCALE_1_TO_5";
    estimatedGwa: number;
    gwaCheckStatus: "MEETS_REQUIREMENT" | "BELOW_REQUIREMENT" | "UNAVAILABLE";
    meetsGwaRequirement: boolean;
    gwaMessage: string;
    hasPossibleFailingGrade: boolean;
    flaggedSubjects: string[];
    flaggedGrades: string[];
    possibleFailingGradeMessage: string | null;
  },
) {
  return new NextRequest("http://localhost/api/grantee/submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      semester: "2026-2027 First Semester",
      gradeFileUrl: "grantee-submissions/auth-1/grades.pdf",
      coeFileUrl: "grantee-submissions/auth-1/coe.pdf",
      forceSubmit,
      gradeDiagnostics,
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

  it.each(["PENDING", "APPROVED"])(
    "rejects a duplicate %s submission before writing",
    async (status) => {
      mocks.submissionFindFirst.mockResolvedValue({ status });

      const response = await POST(createRequest());
      const payload = await response.json();

      expect(response.status).toBe(409);
      expect(payload.error).toBe("Your submission for this term is already under review.");
      expect(mocks.submissionCreate).not.toHaveBeenCalled();
      expect(mocks.submissionUpdate).not.toHaveBeenCalled();
    },
  );

  it("rejects a duplicate found again inside the transaction", async () => {
    mocks.transactionSubmissionFindFirst.mockResolvedValue({
      id: "submission-1",
      status: "PENDING",
      reviewedById: null,
      reviewedAt: null,
      submittedAt: new Date(),
    });

    const response = await POST(createRequest());
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toBe("Your submission for this term is already under review.");
    expect(mocks.submissionCreate).not.toHaveBeenCalled();
  });

  it("accepts a returned submission and moves it back to pending review", async () => {
    const submittedAt = new Date(Date.now() - 60_000);
    const returnedSubmission = {
      id: "submission-returned",
      granteeId: "grantee-1",
      semester: "2026-2027 First Semester",
      status: "RETURNED_FOR_EDIT",
      gradeFileUrl: "grantee-submissions/auth-1/old-grades.pdf",
      coeFileUrl: "grantee-submissions/auth-1/coe.pdf",
      flaggedFields: ["GRADE_REPORT"],
      resubmittedFields: [],
      reviewNotes: "Please replace the grade report.",
      requiresStrictManualReview: false,
      reviewedById: null,
      reviewedAt: null,
      submittedAt,
    };
    mocks.submissionFindFirst
      .mockResolvedValueOnce(returnedSubmission)
      .mockResolvedValueOnce(null);
    mocks.transactionSubmissionFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(returnedSubmission);
    mocks.submissionUpdate.mockImplementation(async ({ data }) => ({
      ...returnedSubmission,
      ...data,
      coeStatus: "PENDING",
      gradesStatus: "PENDING",
      coeSubmittedAt: data.submittedAt,
      coeApprovedAt: null,
      gradesSubmittedAt: null,
      gradesApprovedAt: null,
    }));

    const response = await POST(createRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.submission.status).toBe("PENDING");
    expect(mocks.submissionUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "PENDING" }),
    }));
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

  it("persists upload-time grade diagnostics without blocking submission", async () => {
    const gradeDiagnostics = {
      detectedScale: "PERCENTAGE_100" as const,
      estimatedGwa: 74,
      gwaCheckStatus: "BELOW_REQUIREMENT" as const,
      meetsGwaRequirement: false,
      gwaMessage: "Estimated GWA does not meet the 80% maintenance requirement.",
      hasPossibleFailingGrade: true,
      flaggedSubjects: ["GE 101 Communication Skills: 74"],
      flaggedGrades: ["GE 101 Communication Skills: 74"],
      possibleFailingGradeMessage:
        "Possible failing grade detected. An SK Admin will verify your official grade report.",
    };

    const response = await POST(createRequest(false, gradeDiagnostics));

    expect(response.status).toBe(200);
    expect(mocks.submissionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        requiresStrictManualReview: true,
        ocrParsedRows: expect.objectContaining({
          clientGradeDiagnostics: gradeDiagnostics,
        }),
      }),
    }));
    expect(mocks.processSubmissionGradeReportOcr).toHaveBeenCalledWith("submission-1", {
      manualReviewRequired: false,
    });
  });
});
