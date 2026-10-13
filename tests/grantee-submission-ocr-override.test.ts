import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  userUpdate: vi.fn(),
  submissionFindFirst: vi.fn(),
  submissionCreate: vi.fn(),
  submissionUpdate: vi.fn(),
  analyzeSubmissionOcr: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst: mocks.userFindFirst, update: mocks.userUpdate },
    submission: {
      findFirst: mocks.submissionFindFirst,
      create: mocks.submissionCreate,
      update: mocks.submissionUpdate,
    },
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
  analyzeSubmissionOcr: mocks.analyzeSubmissionOcr,
}));

vi.mock("@/lib/semester-progress", () => ({
  getCurrentAcademicSemester: () => "2026-2027 First Semester",
  isAllowedAcademicSemester: () => true,
}));

import { NextRequest } from "next/server";
import { POST } from "../app/api/grantee/submissions/route";

const OCR_ANALYSIS = {
  status: "OCR_DONE",
  rawText: "Transcript of Grade and Rating",
  parsed: {
    rows: [],
    unrecognizedRows: [],
    gwa: 1.75,
    totalUnits: 3,
  },
  confidence: 98,
  documentValidation: {
    certificateOfEnrollment: true,
    gradeReport: true,
  },
};

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

describe("grantee submission OCR override", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userFindFirst.mockResolvedValue({
      id: "user-1",
      authId: "auth-1",
      role: "GRANTEE",
      grantee: { id: "grantee-1", status: "ACTIVE" },
    });
    mocks.submissionFindFirst.mockResolvedValue(null);
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
    mocks.analyzeSubmissionOcr.mockResolvedValue(OCR_ANALYSIS);
  });

  it("returns an override warning without saving when document keywords fail", async () => {
    mocks.analyzeSubmissionOcr.mockResolvedValue({
      ...OCR_ANALYSIS,
      status: "OCR_NEEDS_REVIEW",
      documentValidation: {
        certificateOfEnrollment: false,
        gradeReport: true,
      },
    });

    const response = await POST(createRequest());

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ requiresOverride: true });
    expect(mocks.submissionCreate).not.toHaveBeenCalled();
  });

  it("saves a forced submission in the manual-review OCR state", async () => {
    mocks.analyzeSubmissionOcr.mockResolvedValue({
      ...OCR_ANALYSIS,
      status: "OCR_NEEDS_REVIEW",
      documentValidation: {
        certificateOfEnrollment: false,
        gradeReport: true,
      },
    });

    const response = await POST(createRequest(true));

    expect(response.status).toBe(200);
    expect(mocks.submissionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        ocrStatus: "OCR_NEEDS_REVIEW",
        ocrParsedRows: expect.objectContaining({ forcedManualReview: true }),
      }),
    }));
  });
});
