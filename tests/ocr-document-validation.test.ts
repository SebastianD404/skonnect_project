import { describe, expect, it } from "vitest";
import {
  validateCertificateOfEnrollment,
  validateGradeReport,
} from "../lib/ocr/document-validation";

describe("submission OCR document validation", () => {
  it("recognizes a Certificate of Enrollment with at least two keywords", () => {
    expect(validateCertificateOfEnrollment("CERTIFICATE of Enrollment")).toBe(true);
    expect(validateCertificateOfEnrollment("Enrolled for academic year 2026-2027")).toBe(true);
    expect(validateCertificateOfEnrollment("Certificate of Registration, First Semester schedule")).toBe(true);
    expect(validateCertificateOfEnrollment("SY 2026-2027 course and year level")).toBe(false);
    expect(validateCertificateOfEnrollment("Enrollment record")).toBe(false);
    expect(validateCertificateOfEnrollment("A busy student")).toBe(false);
    expect(validateCertificateOfEnrollment(
      "SKEAP Application Form. Enrolled students enter their academic year, course, and year level."
    )).toBe(false);
  });

  it("recognizes a grade report with at least two keywords", () => {
    expect(validateGradeReport("Transcript of Grade and Rating")).toBe(true);
    expect(validateGradeReport("Subject list")).toBe(false);
  });
});
