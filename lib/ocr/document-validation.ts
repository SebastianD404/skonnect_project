import { getSkeapDocumentKeywordMatches } from "@/lib/skeap-document-keywords";
import { SKEAP_UPLOAD_KEY } from "@/lib/skeap-upload";

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

const GRADE_REPORT_HARD_NEGATIVE_KEYWORDS = [
  "application form",
  "scholarship application",
  "journal",
  "chapter 1",
  "article info",
];

const GRADE_REPORT_SOFT_NEGATIVE_KEYWORDS = [
  "abstract",
  "issn",
  "methodology",
  "references",
];

const GRADE_REPORT_CLINICAL_KEYWORDS = [
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

const COE_CLINICAL_KEYWORDS = [
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

function normalizeFileName(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .toLowerCase();
}

function isCertificateOfEnrollmentFileName(fileName: string) {
  const normalizedFileName = normalizeFileName(fileName);
  return /\b(?:coe|coee|certificate of (?:enrollment|enrolment|registration)|(?:enrollment|enrolment|registration) certificate)\b/.test(
    normalizedFileName
  );
}

function isGradeReportFileName(fileName: string) {
  return /\b(?:grade report|report card|transcript|form 138)\b/.test(
    normalizeFileName(fileName)
  );
}

function getClinicalMatchCount(text: string, keywords: string[]) {
  return keywords.filter((keyword) => containsKeyword(text.toLowerCase(), keyword)).length;
}

export function validateCertificateOfEnrollment(text: string, fileName = "") {
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

  const hasFuzzyEnrollmentCertificateTitle = getSkeapDocumentKeywordMatches(
    text,
    SKEAP_UPLOAD_KEY.ENROLLMENT_CERT
  ).some((keyword) =>
    /^(certificate of (?:enrollment|enrolment|registration|matriculation)|(?:enrollment|enrolment|registration) certificate)$/.test(
      keyword
    )
  );
  const hasEnrollmentFileName = isCertificateOfEnrollmentFileName(fileName);
  const hasStrongEnrollmentEvidence =
    isExplicitEnrollmentCertificate || hasFuzzyEnrollmentCertificateTitle || hasEnrollmentFileName;
  const hasConflictingClinicalContent =
    getClinicalMatchCount(text, COE_CLINICAL_KEYWORDS) >= 3 && !hasEnrollmentFileName;

  if (hasConflictingClinicalContent) return false;
  return hasStrongEnrollmentEvidence || (hasEnrollmentIndicator && hasAcademicContext);
}

export function validateGradeReport(text: string, fileName = "") {
  const normalizedText = text.toLowerCase();
  if (GRADE_REPORT_HARD_NEGATIVE_KEYWORDS.some((keyword) => containsKeyword(normalizedText, keyword))) {
    return false;
  }

  const hasGradeReportFileName = isGradeReportFileName(fileName);
  if (
    !hasGradeReportFileName &&
    GRADE_REPORT_SOFT_NEGATIVE_KEYWORDS.some((keyword) => containsKeyword(normalizedText, keyword))
  ) {
    return false;
  }

  const hasFuzzyGradeReportTitle = getSkeapDocumentKeywordMatches(
    text,
    SKEAP_UPLOAD_KEY.GRADE_REPORT
  ).some((keyword) =>
    /^(grade report|report card|transcript|transcript of records|form 138|report of rating|final rating|final grade)$/.test(
      keyword
    )
  );
  const hasPrimaryKeyword = PRIMARY_GRADE_KEYWORDS.some((keyword) =>
    containsKeyword(normalizedText, keyword)
  );
  const secondaryMatchCount = SECONDARY_GRADE_KEYWORDS.filter((keyword) =>
    containsKeyword(normalizedText, keyword)
  ).length;
  const hasStrongGradeReportTitle = hasFuzzyGradeReportTitle || hasGradeReportFileName;
  const hasConflictingClinicalContent =
    getClinicalMatchCount(text, GRADE_REPORT_CLINICAL_KEYWORDS) >= 2 &&
    !hasStrongGradeReportTitle;

  if (hasConflictingClinicalContent) return false;
  return hasPrimaryKeyword || hasFuzzyGradeReportTitle || secondaryMatchCount >= 3 || hasGradeReportFileName;
}
