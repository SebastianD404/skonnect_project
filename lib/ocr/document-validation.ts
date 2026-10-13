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

const GRADE_REPORT_KEYWORDS = [
  "grade",
  "transcript",
  "rating",
  "average",
  "semester",
  "course",
  "subject",
  "unit",
];

function containsKeyword(text: string, keyword: string) {
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = escapedKeyword.replace(/\s+/g, "\\s+");
  return new RegExp(`\\b${pattern}\\b`).test(text);
}

function containsEnoughKeywords(text: string, keywords: string[]) {
  const normalizedText = text.toLowerCase();
  return keywords.filter((keyword) => containsKeyword(normalizedText, keyword)).length >= 2;
}

export function validateCertificateOfEnrollment(text: string) {
  const normalizedText = text.toLowerCase();
  if (/\b(application form|scholarship application)\b/.test(normalizedText)) {
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
  return containsEnoughKeywords(text, GRADE_REPORT_KEYWORDS);
}
