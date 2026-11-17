import { doesOcrTextMatchName } from "@/lib/ocrNameVerification";
import { hasExplicitBackIdSideEvidence } from "@/lib/ocrWorker";
import {
  extractResidencyDuration,
  hasBarangayPicoIssuer,
  MINIMUM_RESIDENCY_MONTHS,
  MINIMUM_RESIDENCY_MONTHS_TEXT,
} from "@/lib/residency-requirement";
import {
  parseGradeReportText,
  type GradeReportDiagnostics,
} from "@/lib/grade-report-parser";

export type { GradeReportDiagnostics };

export function analyzeGradeReportText(text: string): GradeReportDiagnostics {
  const parsed = parseGradeReportText(text);
  return {
    detectedScale: parsed.detectedScale,
    estimatedGwa: parsed.estimatedGwa,
    gwaCheckStatus: parsed.gwaCheckStatus,
    meetsGwaRequirement: parsed.meetsGwaRequirement,
    gwaMessage: parsed.gwaMessage,
    hasPossibleFailingGrade: parsed.hasPossibleFailingGrade,
    flaggedSubjects: parsed.flaggedSubjects,
    flaggedGrades: parsed.flaggedGrades,
    possibleFailingGradeMessage: parsed.possibleFailingGradeMessage,
  };
}

type DocumentType =
  | "validIdFront"
  | "validIdBack"
  | "front_id"
  | "back_id"
  | "certificate";
type NormalizedDocumentType = "front_id" | "back_id" | "certificate";

type OcrValidationOptions = {
  firstName?: string;
  lastName?: string;
  middleInitial?: string;
  profileBirthDate?: string;
};

export type ScanResult = {
  success: boolean;
  status: "success" | "error" | "needs_review";
  badgeText: string;
  message: string;
  isValid: boolean;
  matchedKeywords: string[];
  text: string;
  error?: string;
  errorCode?: string;
  nameMatched?: boolean;
  parsedDates?: string[];
  birthdateMatched?: boolean;
};

const SCANNER_UNAVAILABLE_MESSAGE = "System error: Scanner temporarily unavailable.";
const UNREADABLE_DOCUMENT_MESSAGE =
  "We couldn't clearly read the text. Please ensure good lighting and try again.";
const ID_VALIDATION_ERROR_MESSAGE = "Please Upload a Correct Valid ID.";
const MINIMUM_OCR_CONFIDENCE = 30;
const WORKER_PATH =
  "https://cdn.jsdelivr.net/npm/tesseract.js@v7.0.0/dist/worker.min.js";
const CORE_PATH =
  "https://cdn.jsdelivr.net/npm/tesseract.js-core@v7.0.0";
const LANGUAGE_PATH =
  "https://cdn.jsdelivr.net/gh/naptha/tessdata@gh-pages/4.0.0_best_int";

const ID_KEYWORDS = [
  "Republic of the Philippines", "Philippines", "Pilipinas", "Republika", "Filipino",
  "Filipina", "ID", "Identity", "Name", "Date of Birth", "Birth Date", "Address",
  "Sex", "Gender", "Male", "Female", "Civil Status", "Single", "Married", "Driver",
  "License", "PHILHEALTH", "UMID", "TIN", "VOTER", "Student", "School", "University",
  "College", "Campus", "Pico", "La Trinidad", "Benguet", "Contact No", "Emergency",
  "Information", "Identification", "Card", "Contact", "Signature", "Rules", "Birthdate",
  "Registrar", "Barangay", "Valid", "Issued", "No.", "Specimen",
];
const FRONT_ID_TERMS = [
  "Photo", "Nationality", "Height", "Weight", "License No", "Expiration Date",
  "Passport No", "ID Number", "ID No", "Card Number", "Name", "Student", "College",
  "University", "School",
];
const BACK_ID_TERMS = [
  "ID", "Student", "Identification", "Magnetic Stripe", "Stripe Code", "Restrictions",
  "Restriction", "Endorsements", "Organ Donor", "Organ Donation", "Barcode", "QR Code",
  "Emergency", "Contact", "Signature", "Rules", "Address", "Birthdate", "Registrar",
  "Barangay", "Valid", "Issued", "No.", "Specimen", "Name", "Card",
];
const CERTIFICATE_TERMS = [
  "Certificate of Residency", "Barangay Pico", "Pico", "resident", "residing",
  "Certificate", "Residency",
];
const CERTIFICATE_DOCUMENT_TERMS = [
  "Certificate of Residency", "certificate", "residency", "resident", "residing",
];
const NON_RESIDENCY_CERTIFICATE_TERMS =
  /\b(?:low[\s-]*income|indigency|indigence|(?:certificate|certification)\s+of\s+(?:enrollment|enrolment|registration|live\s+birth|birth|good\s+moral|employment)|coe|cli)\b/i;
const RESIDENCY_CERTIFICATE_TITLE =
  /\b(?:certificate\s+of\s+(?:residency|residence)|(?:residency|residence)\s+certificate|proof\s+of\s+(?:residency|residence))\b/i;
const BARANGAY_RESIDENCY_STATEMENT =
  /\b(?:resident|residing|resided|living|lived)\b[\s\S]{0,80}\b(?:barangay|brgy\.?|pico)\b|\b(?:barangay|brgy\.?|pico)\b[\s\S]{0,80}\b(?:resident|residing|resided|living|lived)\b/i;

type BrowserOcrWorker = Awaited<ReturnType<typeof createBrowserWorker>>;

let workerPromise: Promise<BrowserOcrWorker> | null = null;
let scanQueue: Promise<void> = Promise.resolve();

function normalizeDocumentType(documentType: DocumentType): NormalizedDocumentType {
  if (documentType === "validIdFront") return "front_id";
  if (documentType === "validIdBack") return "back_id";
  return documentType;
}

async function createBrowserWorker() {
  const { createWorker } = await import("tesseract.js");
  return createWorker("eng", 1, {
    workerPath: WORKER_PATH,
    corePath: CORE_PATH,
    langPath: LANGUAGE_PATH,
    workerBlobURL: true,
  });
}

function getBrowserWorker() {
  if (!workerPromise) {
    workerPromise = createBrowserWorker();
  }
  return workerPromise;
}

function findMatches(text: string, keywords: string[]) {
  const normalize = (value: string) =>
    ` ${value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ")} `;
  const normalized = normalize(text);
  return keywords.filter((keyword) => normalized.includes(normalize(keyword)));
}

function invalidResult(
  badgeText: string,
  message: string,
  text = "",
  errorCode?: string,
): ScanResult {
  return {
    success: false,
    status: "error",
    badgeText,
    message,
    isValid: false,
    matchedKeywords: [],
    text,
    errorCode,
  };
}

export function validateRecognizedText(
  documentType: DocumentType,
  text: string,
  options?: OcrValidationOptions,
): ScanResult {
  const normalizedDocumentType = normalizeDocumentType(documentType);
  const normalizedText = text.trim();
  if (normalizedText.length < 10) {
    const isId = normalizedDocumentType === "front_id" || normalizedDocumentType === "back_id";
    return invalidResult(
      "Unreadable Image",
      isId ? ID_VALIDATION_ERROR_MESSAGE : UNREADABLE_DOCUMENT_MESSAGE,
      text,
      "LOW_CONFIDENCE",
    );
  }

  if (normalizedDocumentType === "front_id" || normalizedDocumentType === "back_id") {
    const matchedKeywords = findMatches(normalizedText, ID_KEYWORDS);
    const frontMatches = findMatches(normalizedText, FRONT_ID_TERMS);
    const backMatches = findMatches(normalizedText, BACK_ID_TERMS);
    const hasCertificateTerms = findMatches(normalizedText, CERTIFICATE_DOCUMENT_TERMS).length > 0;
    const hasIdCardAnchor = /\b(?:id|identification|student|card|registrar|barangay)\b/i.test(normalizedText);
    const strongFrontMatches = frontMatches.filter((match) => match.toLowerCase() !== "name");
    const looksLikeBackId = backMatches.length > 0 && strongFrontMatches.length === 0;
    if (
      normalizedDocumentType === "front_id" &&
      looksLikeBackId &&
      hasExplicitBackIdSideEvidence(normalizedText)
    ) {
      return invalidResult(
        "Wrong ID Side",
        ID_VALIDATION_ERROR_MESSAGE,
        normalizedText,
        "WRONG_DOCUMENT_SIDE",
      );
    }

    const hasSchoolIdText =
      /\b(student|college|university|school|id no\.?|id\s*no\.?|id number)\b/i.test(normalizedText);
    const hasIdSignal = matchedKeywords.length >= 2 || hasSchoolIdText;
    const isClearlyNonIdCertificate =
      hasCertificateTerms &&
      !/\b(?:id|identification|student|school|college|university|card)\b/i.test(normalizedText);
    const isValid = normalizedDocumentType === "front_id"
      ? hasIdSignal && !hasCertificateTerms && (frontMatches.length > 0 || hasSchoolIdText)
      : !isClearlyNonIdCertificate &&
        (backMatches.length > 0 || hasIdCardAnchor || hasSchoolIdText);

    if (!isValid) {
      return invalidResult(
        "Unrecognized Document",
        ID_VALIDATION_ERROR_MESSAGE,
        normalizedText,
        "UNRECOGNIZED_DOCUMENT",
      );
    }

    if (
      normalizedDocumentType === "front_id" &&
      options?.firstName &&
      options.lastName
    ) {
      const nameMatched = doesOcrTextMatchName(options.firstName, options.lastName, normalizedText);
      if (!nameMatched) {
        return {
          ...invalidResult(
            "Name Mismatch",
            ID_VALIDATION_ERROR_MESSAGE,
            normalizedText,
            "NAME_MISMATCH",
          ),
          nameMatched: false,
        };
      }

      return {
        success: true,
        status: "success",
        badgeText: "Verified",
        message: "ID text verified.",
        isValid: true,
        matchedKeywords,
        text: normalizedText,
        nameMatched: true,
      };
    }

    return {
      success: true,
      status: "success",
      badgeText: "Verified",
      message: "Document text verified.",
      isValid: true,
      matchedKeywords,
      text: normalizedText,
    };
  }

  const matchedKeywords = findMatches(normalizedText, CERTIFICATE_TERMS);
  const residencyDuration = extractResidencyDuration(normalizedText);
  const isNonResidencyCertificate = NON_RESIDENCY_CERTIFICATE_TERMS.test(normalizedText);
  const hasResidencyEvidence =
    RESIDENCY_CERTIFICATE_TITLE.test(normalizedText) ||
    BARANGAY_RESIDENCY_STATEMENT.test(normalizedText);
  if (
    isNonResidencyCertificate ||
    matchedKeywords.length === 0 ||
    !hasResidencyEvidence ||
    !hasBarangayPicoIssuer(normalizedText)
  ) {
    return invalidResult(
      "Unrecognized Document",
      "Please upload a Certificate of Residency issued by Barangay Pico, La Trinidad.",
      normalizedText,
      "UNRECOGNIZED_DOCUMENT",
    );
  }

  if (!residencyDuration) {
    return invalidResult(
      "Needs Manual Check",
      `We couldn't automatically confirm the residency duration from this photo. To qualify for SKEAP, the certificate must show you have lived in Barangay Pico for at least ${MINIMUM_RESIDENCY_MONTHS_TEXT}.`,
      normalizedText,
      "RESIDENCY_DURATION_UNCONFIRMED",
    );
  }

  if (residencyDuration.months < MINIMUM_RESIDENCY_MONTHS) {
    return invalidResult(
      "Residency Duration Too Short",
      `This certificate shows less than the required ${MINIMUM_RESIDENCY_MONTHS_TEXT} of residency in Barangay Pico. Please upload an updated certificate.`,
      normalizedText,
      "RESIDENCY_TOO_SHORT",
    );
  }

  if (options?.firstName && options.lastName &&
    !doesOcrTextMatchName(options.firstName, options.lastName, normalizedText)) {
    return {
      ...invalidResult(
        "Name Mismatch",
        "Name mismatch — the name on this document does not match the profile.",
        normalizedText,
        "NAME_MISMATCH",
      ),
      nameMatched: false,
    };
  }

  return {
    success: true,
    status: "success",
    badgeText: "Verified",
    message: "Certificate of Residency text verified.",
    isValid: true,
    matchedKeywords,
    text: normalizedText,
    nameMatched: options?.firstName && options.lastName ? true : undefined,
  };
}

async function recognizeFile(file: File) {
  const queuedScan = scanQueue.then(async () => {
    const worker = await getBrowserWorker();
    await worker.setParameters({ tessedit_pageseg_mode: "11" });
    const { data } = await worker.recognize(file);
    return {
      text: String(data.text ?? ""),
      confidence: Number(data.confidence ?? 0),
    };
  });
  scanQueue = queuedScan.then(() => undefined, () => undefined);
  return queuedScan;
}

export async function scanDocument(
  file: File,
  documentType: DocumentType,
  options?: OcrValidationOptions,
): Promise<ScanResult> {
  try {
    const { text, confidence } = await recognizeFile(file);
    const normalizedDocumentType = normalizeDocumentType(documentType);
    if (
      !text.trim() ||
      (confidence < MINIMUM_OCR_CONFIDENCE && normalizedDocumentType !== "back_id")
    ) {
      const isId =
        normalizedDocumentType === "front_id" ||
        normalizedDocumentType === "back_id";
      return invalidResult(
        "Unreadable Image",
        isId ? ID_VALIDATION_ERROR_MESSAGE : UNREADABLE_DOCUMENT_MESSAGE,
        text,
        "LOW_CONFIDENCE",
      );
    }
    return validateRecognizedText(normalizedDocumentType, text, options);
  } catch (error) {
    console.error("Browser document scanner failed to initialize or process the file.", error);
    const failedWorker = workerPromise;
    workerPromise = null;
    if (failedWorker) {
      try {
        const worker = await failedWorker;
        await worker.terminate();
      } catch (cleanupError) {
        console.error("Could not stop the failed browser OCR worker.", cleanupError);
      }
    }
    return invalidResult(
      "Scanner Unavailable",
      SCANNER_UNAVAILABLE_MESSAGE,
      "",
      "SCANNER_UNAVAILABLE",
    );
  }
}
