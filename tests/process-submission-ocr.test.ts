import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  download: vi.fn(),
  extractDocumentOcr: vi.fn(),
  processGradeReportOcr: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { submission: { findUnique: mocks.findUnique, updateMany: mocks.updateMany } },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: { from: () => ({ download: mocks.download }) },
  }),
}));

vi.mock("@/lib/ocr/grade-report-ocr", () => ({
  extractDocumentOcr: mocks.extractDocumentOcr,
  processGradeReportOcr: mocks.processGradeReportOcr,
}));

vi.mock("@/lib/ocr/storage", () => ({
  getSubmissionStorageObject: () => ({ bucket: "grantee-submissions", path: "user/file.pdf" }),
}));

import { processSubmissionGradeReportOcr } from "../lib/ocr/process-submission";

describe("processSubmissionGradeReportOcr", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue({
      id: "submission-1",
      gradeFileUrl: "grantee-submissions/user/file.pdf",
      coeFileUrl: "grantee-submissions/user/coe.pdf",
      requiresStrictManualReview: false,
      grantee: { user: { authId: "user-1" } },
    });
    mocks.download.mockResolvedValue({
      data: new Blob(["document"]),
      error: null,
    });
    mocks.processGradeReportOcr.mockRejectedValue(new Error("OCR engine unavailable"));
    mocks.extractDocumentOcr.mockResolvedValue({
      rawText: "Certificate of Enrollment, Semester Schedule",
      confidence: 99,
    });
    mocks.updateMany.mockResolvedValue({ count: 1 });
  });

  it("marks the submission OCR_FAILED when OCR processing throws", async () => {
    await processSubmissionGradeReportOcr("submission-1");

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: "submission-1",
        gradeFileUrl: "grantee-submissions/user/file.pdf",
        coeFileUrl: "grantee-submissions/user/coe.pdf",
        ocrStatus: "OCR_PENDING",
      },
      data: {
        ocrStatus: "OCR_FAILED",
        ocrGwa: null,
        ocrTotalUnits: null,
        ocrConfidence: null,
      },
    });
  });

  it("marks OCR as failed when processing exceeds 30 seconds", async () => {
    vi.useFakeTimers();
    mocks.processGradeReportOcr.mockReturnValue(new Promise(() => {}));

    const processing = processSubmissionGradeReportOcr("submission-1");
    await vi.advanceTimersByTimeAsync(30_000);
    await processing;

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: "submission-1",
        gradeFileUrl: "grantee-submissions/user/file.pdf",
        coeFileUrl: "grantee-submissions/user/coe.pdf",
        ocrStatus: "OCR_PENDING",
      },
      data: {
        ocrStatus: "OCR_FAILED",
        ocrGwa: null,
        ocrTotalUnits: null,
        ocrConfidence: null,
      },
    });
    vi.useRealTimers();
  });

  it("requires manual review when either document does not match its claimed type", async () => {
    mocks.extractDocumentOcr.mockResolvedValue({
      rawText: "Certificate of Enrollment, Student Semester Schedule",
      confidence: 99,
    });
    mocks.processGradeReportOcr.mockResolvedValue({
      status: "OCR_DONE",
      rawText: "SUBJ101 Computing 3 1.25",
      parsed: {
        rows: [{ subjectCode: "SUBJ101", subjectName: "Computing", units: 3, grade: 1.25, flag: null }],
        unrecognizedRows: [],
        gwa: 1.25,
        totalUnits: 3,
      },
      confidence: 99,
    });

    await processSubmissionGradeReportOcr("submission-1");

    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: "submission-1",
        gradeFileUrl: "grantee-submissions/user/file.pdf",
        coeFileUrl: "grantee-submissions/user/coe.pdf",
        ocrStatus: "OCR_PENDING",
      },
      data: expect.objectContaining({
        ocrStatus: "OCR_NEEDS_REVIEW",
        ocrGwa: 1.25,
        ocrParsedRows: expect.objectContaining({
          documentValidation: {
            certificateOfEnrollment: true,
            gradeReport: false,
          },
        }),
      }),
    }));
  });

  it("saves the parsed weighted GWA when both document types validate", async () => {
    mocks.extractDocumentOcr.mockResolvedValue({
      rawText: "Certificate of Enrollment and Academic Schedule",
      confidence: 99,
    });
    mocks.processGradeReportOcr.mockResolvedValue({
      status: "OCR_DONE",
      rawText: "Transcript of Grade and Rating\nSUBJ101 Computing 3 1.25",
      parsed: {
        rows: [{ subjectCode: "SUBJ101", subjectName: "Computing", units: 3, grade: 1.25, flag: null }],
        unrecognizedRows: [],
        gwa: 1.25,
        totalUnits: 3,
      },
      confidence: 99,
    });

    await processSubmissionGradeReportOcr("submission-1");

    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        ocrStatus: "OCR_DONE",
        ocrGwa: 1.25,
        ocrTotalUnits: 3,
        ocrParsedRows: expect.objectContaining({
          documentValidation: {
            certificateOfEnrollment: true,
            gradeReport: true,
          },
        }),
      }),
    }));
  });

  it("keeps forced submissions in manual review while saving the extracted GWA", async () => {
    mocks.extractDocumentOcr.mockResolvedValue({
      rawText: "Certificate of Enrollment and Academic Schedule",
      confidence: 99,
    });
    mocks.processGradeReportOcr.mockResolvedValue({
      status: "OCR_DONE",
      rawText: "Transcript of Grade and Rating\nSUBJ101 Computing 3 1.25",
      parsed: {
        rows: [{ subjectCode: "SUBJ101", subjectName: "Computing", units: 3, grade: 1.25, flag: null }],
        unrecognizedRows: [],
        gwa: 1.25,
        totalUnits: 3,
      },
      confidence: 99,
    });

    await processSubmissionGradeReportOcr("submission-1", { manualReviewRequired: true });

    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        ocrStatus: "OCR_NEEDS_REVIEW",
        ocrGwa: 1.25,
        ocrTotalUnits: 3,
        ocrParsedRows: expect.objectContaining({
          forcedManualReview: true,
        }),
      }),
    }));
  });

  it("persists a failing-grade warning detected by server OCR", async () => {
    mocks.extractDocumentOcr.mockResolvedValue({
      rawText: "Certificate of Enrollment and Academic Schedule",
      confidence: 99,
    });
    mocks.processGradeReportOcr.mockResolvedValue({
      status: "OCR_DONE",
      rawText: "Transcript of Grades\nMATH 101 3 74",
      parsed: {
        rows: [{ subjectCode: "MATH101", subjectName: "Math", units: 3, grade: 74, flag: "FAIL" }],
        unrecognizedRows: [],
        gwa: 74,
        totalUnits: 3,
      },
      confidence: 99,
    });

    await processSubmissionGradeReportOcr("submission-1");

    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        requiresStrictManualReview: true,
      }),
    }));
  });

  it("requires manual review when the Certificate of Enrollment keywords do not match", async () => {
    mocks.extractDocumentOcr.mockResolvedValue({
      rawText: "Personal letter without enrollment details",
      confidence: 99,
    });
    mocks.processGradeReportOcr.mockResolvedValue({
      status: "OCR_DONE",
      rawText: "Transcript of Grade and Rating",
      parsed: { rows: [], unrecognizedRows: [], gwa: 2, totalUnits: 3 },
      confidence: 99,
    });

    await processSubmissionGradeReportOcr("submission-1");

    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        ocrStatus: "OCR_NEEDS_REVIEW",
        ocrParsedRows: expect.objectContaining({
          documentValidation: {
            certificateOfEnrollment: false,
            gradeReport: true,
          },
        }),
      }),
    }));
  });
});
