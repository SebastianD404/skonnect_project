import { describe, expect, it } from "vitest";
import {
  computeGradeReportGwa,
  validateCorrectedGradeReportRows,
} from "../lib/ocr/override-validation";
import {
  getPreviousAcademicSemester,
  isAllowedAcademicSemester,
} from "../lib/semester-progress";

describe("OCR override validation", () => {
  it("computes a weighted PH-scale GWA and excludes flagged rows", () => {
    const rows = validateCorrectedGradeReportRows([
      { subjectName: "Mathematics", units: 3, grade: 1.25, flag: null },
      { subjectName: "English", units: 2, grade: 1.75, flag: null },
      { subjectName: "Physical Education", units: 2, grade: null, flag: "DRP" },
      { subjectName: "Science", units: 3, grade: null, flag: "FAILED" },
    ]);

    expect(computeGradeReportGwa(rows)).toEqual({ gwa: 1.45, totalUnits: 5 });
  });

  it("rejects out-of-range grades and unsupported terms", () => {
    expect(() =>
      validateCorrectedGradeReportRows([
        { subjectName: "Mathematics", units: 3, grade: 5, flag: null },
      ])
    ).toThrow("grade from 1.0 to below 5.0");
    expect(isAllowedAcademicSemester("2025-2026 Summer Semester")).toBe(false);
    expect(getPreviousAcademicSemester("2025-2026 First Semester")).toBe(
      "2024-2025 Second Semester"
    );
  });
});
