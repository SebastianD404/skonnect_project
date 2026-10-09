import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  download: vi.fn(),
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
      grantee: { user: { authId: "user-1" } },
    });
    mocks.download.mockResolvedValue({
      data: new Blob(["document"]),
      error: null,
    });
    mocks.processGradeReportOcr.mockRejectedValue(new Error("OCR engine unavailable"));
    mocks.updateMany.mockResolvedValue({ count: 1 });
  });

  it("marks the submission OCR_FAILED when OCR processing throws", async () => {
    await processSubmissionGradeReportOcr("submission-1");

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: "submission-1",
        gradeFileUrl: "grantee-submissions/user/file.pdf",
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
});
