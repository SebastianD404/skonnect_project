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
    expect(validateCertificateOfEnrollment(
      "Certificate of Enrollment for a nursing student with patient vital signs and blood pressure."
    )).toBe(false);
  });

  it("recognizes common OCR errors in enrollment certificate titles", () => {
    expect(validateCertificateOfEnrollment("CERTIFICAT OF ENROLLMENT")).toBe(true);
    expect(validateCertificateOfEnrollment("CERTIFICATE OF ENROLMENT")).toBe(true);
    expect(validateCertificateOfEnrollment("CERTIFICATE OF REGISTRAT1ON")).toBe(true);
  });

  it("allows academic enrollment documents that mention clinical coursework", () => {
    expect(validateCertificateOfEnrollment("Certificate of Enrollment for a nursing student taking Patient Care")).toBe(true);
    expect(validateGradeReport("Report Card - Nursing - Patient Care and Vital Signs")).toBe(true);
  });

  it("uses a clear COE filename as supporting evidence when OCR cannot read the title", () => {
    expect(validateCertificateOfEnrollment("", "COEE.webp")).toBe(true);
    expect(validateCertificateOfEnrollment("", "certificate_of_enrollment.jpg")).toBe(true);
  });

  it("recognizes a grade report with a primary keyword", () => {
    expect(validateGradeReport("Transcript of Grade and Rating")).toBe(true);
    expect(validateGradeReport("Subject list")).toBe(false);
    expect(validateGradeReport("GWA: 3.25")).toBe(true);
    expect(validateGradeReport("FORM 138")).toBe(true);
  });

  it("recognizes common grade-report title variants and OCR errors", () => {
    expect(validateGradeReport("REPOR CARD")).toBe(true);
    expect(validateGradeReport("GRADE REP0RT")).toBe(true);
    expect(validateGradeReport("TRANSCRIPT OF RECORDS")).toBe(true);
    expect(validateGradeReport("FORM 138")).toBe(true);
  });

  it("uses a descriptive grade-report filename when OCR cannot read the title", () => {
    expect(validateGradeReport("", "report card.jpg")).toBe(true);
    expect(validateGradeReport("", "grade_report.pdf")).toBe(true);
  });

  it("uses the supplied grade-report filename when OCR picks up incidental reference text", () => {
    expect(validateGradeReport(
      "Student Name, Semester, Subject, Grades, References",
      "report card.jpg"
    )).toBe(true);
  });

  it("recognizes the uploaded filenames shown for the grade report and COE", () => {
    expect(validateGradeReport("Student Name, Semester, Subject, Grades", "report card.jpg")).toBe(true);
    expect(validateCertificateOfEnrollment("Student Name, Academic Year", "COEE.webp")).toBe(true);
  });

  it("requires three distinct secondary grade-report keywords", () => {
    expect(validateGradeReport("Subject, course, and semester")).toBe(true);
    expect(validateGradeReport("Subject and course")).toBe(false);
    expect(validateGradeReport("Year, Semester, Units, Grade, and Remarks")).toBe(true);
  });

  it("recognizes additional primary grade-report terms", () => {
    expect(validateGradeReport("Grade Point Average: 3.25")).toBe(true);
    expect(validateGradeReport("CGPA: 3.25")).toBe(true);
  });

  it("rejects research papers and journals even when grade-report keywords appear", () => {
    expect(validateGradeReport("Abstract: A study of course ratings and semester performance")).toBe(false);
    expect(validateGradeReport("Journal article. Transcript, units, and marks")).toBe(false);
    expect(validateGradeReport("Chapter 1: Methodology for student marks")).toBe(false);
    expect(
      validateGradeReport("SKEAP Application Form. Applicant course, grade, year and semester information.")
    ).toBe(false);
    expect(validateGradeReport(
      "GWA: 3.25. Nursing patient vital signs, blood pressure, and semester information."
    )).toBe(false);
  });

});
