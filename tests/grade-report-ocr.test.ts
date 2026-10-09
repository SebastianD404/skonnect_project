import { describe, expect, it } from "vitest";
import { decideGradeReportOcrStatus } from "../lib/ocr/grade-report-ocr";
import {
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
});
