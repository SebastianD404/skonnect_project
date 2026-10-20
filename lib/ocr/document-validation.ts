const COE_ENROLLMENT_INDICATORS = ["enrollment", "enrolled", "registration"];
const COE_CONTEXT_INDICATORS = [
  "certificate",
  "semester",
  "academic year",
  "sy",
  "course",
  "year level",
  "student",
  "units",
  "schedule",
];

const GRADE_REPORT_NEGATIVE_KEYWORDS = [
  "application form",
  "scholarship application",
  "abstract",
  "issn",
  "methodology",
  "references",
  "journal",
  "chapter 1",
  "article info",
  "patient",
  "vital signs",
  "intake",
  "output",
  "blood pressure",
  "mmhg",
  "spo2",
  "bpm",
  "ivf",
];

const COE_NEGATIVE_KEYWORDS = [
  "patient",
  "vital signs",
  "intake",
  "output",
  "blood pressure",
  "mmhg",
  "spo2",
  "bpm",
  "ivf",
];

const PRIMARY_GRADE_KEYWORDS = [
  "gwa",
  "transcript",
  "form 138",
  "report card",
  "final grade",
  "general weighted average",
  "grading system",
  "grade point average",
  "cgpa",
];

const SECONDARY_GRADE_KEYWORDS = [
  "units",
  "semester",
  "subject",
  "instructor",
  "marks",
  "term",
  "course",
  "rating",
  "student no",
  "student number",
  "grade",
  "grades",
  "year",
  "remarks",
  "prerequisites",
  "credited",
];

function containsKeyword(text: string, keyword: string) {
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = escapedKeyword.replace(/\s+/g, "\\s+");
  return new RegExp(`\\b${pattern}\\b`).test(text);
}

export function validateCertificateOfEnrollment(text: string) {
  const normalizedText = text.toLowerCase();
  if (
    /\b(application form|scholarship application)\b/.test(normalizedText) ||
    COE_NEGATIVE_KEYWORDS.some((keyword) => containsKeyword(normalizedText, keyword))
  ) {
    return false;
  }

  const hasEnrollmentIndicator = COE_ENROLLMENT_INDICATORS.some((keyword) =>
    containsKeyword(normalizedText, keyword)
  );
  const isExplicitEnrollmentCertificate =
    /\bcertificate of (?:enrollment|enrolment|registration)\b/.test(normalizedText) ||
    /\b(?:enrollment|enrolment|registration) certificate\b/.test(normalizedText);
  const hasAcademicContext = COE_CONTEXT_INDICATORS.some((keyword) =>
    containsKeyword(normalizedText, keyword)
  );

  return isExplicitEnrollmentCertificate || (hasEnrollmentIndicator && hasAcademicContext);
}

export function validateGradeReport(text: string) {
  const normalizedText = text.toLowerCase();
  if (GRADE_REPORT_NEGATIVE_KEYWORDS.some((keyword) => containsKeyword(normalizedText, keyword))) {
    return false;
  }

  const hasPrimaryKeyword = PRIMARY_GRADE_KEYWORDS.some((keyword) =>
    containsKeyword(normalizedText, keyword)
  );
  const secondaryMatchCount = SECONDARY_GRADE_KEYWORDS.filter((keyword) =>
    containsKeyword(normalizedText, keyword)
  ).length;

  return hasPrimaryKeyword || secondaryMatchCount >= 3;
}
