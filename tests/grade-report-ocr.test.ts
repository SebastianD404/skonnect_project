import { describe, expect, it } from "vitest";
import {
  decideGradeReportOcrStatus,
  extractDocumentOcr,
} from "../lib/ocr/grade-report-ocr";
import {
  COE_MIME_TYPES,
  GRADE_REPORT_MIME_TYPES,
  hasGradeReportSignature,
  MAX_GRADE_REPORT_BYTES,
} from "../lib/ocr/grade-report-file";

describe("grade report OCR", () => {
  it("requires review for no rows, unrecognized rows, or low OCR confidence", () => {
    expect(decideGradeReportOcrStatus(0, 0, 99)).toBe("OCR_NEEDS_REVIEW");
    expect(decideGradeReportOcrStatus(2, 1, 99)).toBe("OCR_NEEDS_REVIEW");
    expect(decideGradeReportOcrStatus(2, 0, 64)).toBe("OCR_NEEDS_REVIEW");
    expect(decideGradeReportOcrStatus(2, 0, 65)).toBe("OCR_DONE");
    expect(decideGradeReportOcrStatus(2, 0, 99, false)).toBe("OCR_NEEDS_REVIEW");
  });

  it("checks supported file signatures and enforces the upload limit", () => {
    expect(
      hasGradeReportSignature(
        new TextEncoder().encode("%PDF-1.7"),
        "application/pdf"
      )
    ).toBe(true);
    expect(
      hasGradeReportSignature(
        new TextEncoder().encode("%PDF-1.7"),
        "image/png"
      )
    ).toBe(false);
    expect(MAX_GRADE_REPORT_BYTES).toBe(10 * 1024 * 1024);
  });

  it("allows only PDF and image formats for both upload types", () => {
    expect(GRADE_REPORT_MIME_TYPES.has("application/msword")).toBe(false);
    expect(
      GRADE_REPORT_MIME_TYPES.has(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    ).toBe(false);
    expect(COE_MIME_TYPES.has("application/msword")).toBe(false);
    expect(
      COE_MIME_TYPES.has(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    ).toBe(false);
    expect([...COE_MIME_TYPES]).toEqual([...GRADE_REPORT_MIME_TYPES]);
  });

  it("rejects DOC and DOCX before OCR processing", async () => {
    await expect(
      extractDocumentOcr(Buffer.from("Word document"), "application/msword")
    ).rejects.toThrow("Submission documents must be PDF, JPG, PNG, or WEBP files.");
    await expect(
      extractDocumentOcr(
        Buffer.from("Word document"),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    ).rejects.toThrow("Submission documents must be PDF, JPG, PNG, or WEBP files.");
  });
});
