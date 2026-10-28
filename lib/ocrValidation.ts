import { doesOcrTextMatchName } from "@/lib/ocrNameVerification";
import { hasExplicitBackIdSideEvidence } from "@/lib/ocrWorker";
import { verifyBackIdBirthdate } from "@/lib/verifyBackIdBirthdate";

type DocumentType = "front_id" | "back_id" | "certificate";

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
  "Information",
];
const FRONT_ID_TERMS = [
  "Photo", "Nationality", "Height", "Weight", "License No", "Expiration Date",
  "Passport No", "ID Number", "ID No", "Card Number", "Name", "Student", "College",
  "University", "School",
];
const BACK_ID_TERMS = [
  "Magnetic Stripe", "Stripe Code", "Restrictions", "Restriction", "Endorsements",
  "Organ Donor", "Organ Donation", "Barcode", "QR Code",
];
const CERTIFICATE_TERMS = [
  "Certificate of Residency", "Barangay Pico", "Pico", "resident", "residing",
  "Certificate", "Residency",
];
const CERTIFICATE_DOCUMENT_TERMS = [
  "Certificate of Residency", "certificate", "residency", "resident", "residing",
];
const NON_RESIDENCY_CERTIFICATE_TERMS =
  /\b(?:low[\s-]*income|indigency|indigence)\b/i;
const RESIDENCY_CERTIFICATE_TITLE =
  /\b(?:certificate\s+of\s+(?:residency|residence)|(?:residency|residence)\s+certificate|proof\s+of\s+(?:residency|residence))\b/i;
const BARANGAY_RESIDENCY_STATEMENT =
  /\b(?:resident|residing|resided|living|lived)\b[\s\S]{0,80}\b(?:barangay|brgy\.?|pico)\b|\b(?:barangay|brgy\.?|pico)\b[\s\S]{0,80}\b(?:resident|residing|resided|living|lived)\b/i;

type BrowserOcrWorker = Awaited<ReturnType<typeof createBrowserWorker>>;

let workerPromise: Promise<BrowserOcrWorker> | null = null;
let scanQueue: Promise<void> = Promise.resolve();

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
  const normalized = text.toLowerCase();
  return keywords.filter((keyword) => normalized.includes(keyword.toLowerCase()));
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
  const normalizedText = text.trim();
  if (normalizedText.length < 10) {
    return invalidResult("Unreadable Image", UNREADABLE_DOCUMENT_MESSAGE, text, "LOW_CONFIDENCE");
  }

  if (documentType === "front_id" || documentType === "back_id") {
    const matchedKeywords = findMatches(normalizedText, ID_KEYWORDS);
    const frontMatches = findMatches(normalizedText, FRONT_ID_TERMS);
    const backMatches = findMatches(normalizedText, BACK_ID_TERMS);
    const hasCertificateTerms = findMatches(normalizedText, CERTIFICATE_DOCUMENT_TERMS).length > 0;
    const strongFrontMatches = frontMatches.filter((match) => match.toLowerCase() !== "name");
    const looksLikeBackId = backMatches.length > 0 && strongFrontMatches.length === 0;
    if (documentType === "front_id" && looksLikeBackId && hasExplicitBackIdSideEvidence(normalizedText)) {
      return invalidResult(
        "Wrong ID Side",
        "This appears to be the back of the ID. Please upload the front of your valid ID.",
        normalizedText,
        "WRONG_DOCUMENT_SIDE",
      );
    }

    const hasSchoolIdText =
      /\b(student|college|university|school|id no\.?|id\s*no\.?|id number)\b/i.test(normalizedText);
    const hasIdSignal = matchedKeywords.length >= 2 || hasSchoolIdText;
    const isValid = documentType === "front_id"
      ? hasIdSignal && !hasCertificateTerms && (frontMatches.length > 0 || hasSchoolIdText)
      : hasIdSignal &&
        !hasCertificateTerms &&
        (backMatches.length > 0 ||
          normalizedText.replace(/\s+/g, " ").length >= 60 ||
          frontMatches.length === 0);

    if (!isValid) {
      return invalidResult(
        "Unrecognized Document",
        "We couldn't verify this as the requested document. Please check the document type and try again.",
        normalizedText,
        "UNRECOGNIZED_DOCUMENT",
      );
    }

    if (documentType === "front_id" && options?.firstName && options.lastName) {
      const nameMatched = doesOcrTextMatchName(options.firstName, options.lastName, normalizedText);
      if (!nameMatched) {
        return {
          ...invalidResult(
            "Name Mismatch",
            "Name mismatch — the name on this ID does not match the profile.",
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

    if (documentType === "back_id" && options?.profileBirthDate) {
      const birthCheck = verifyBackIdBirthdate(normalizedText, options.profileBirthDate);
      if (!birthCheck.isValid) {
        return {
          ...invalidResult("Birthdate Mismatch", birthCheck.message, normalizedText, "BIRTHDATE_MISMATCH"),
          parsedDates: birthCheck.parsedDates,
          birthdateMatched: false,
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
        parsedDates: birthCheck.parsedDates,
        birthdateMatched: true,
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
  const hasEight = /\b(8|08|eight)\b/i.test(normalizedText);
  const hasMonths = /\b(months?|mos\.?)\b/i.test(normalizedText);
  const isNonResidencyCertificate = NON_RESIDENCY_CERTIFICATE_TERMS.test(normalizedText);
  const hasResidencyEvidence =
    RESIDENCY_CERTIFICATE_TITLE.test(normalizedText) ||
    BARANGAY_RESIDENCY_STATEMENT.test(normalizedText);
  if (
    isNonResidencyCertificate ||
    matchedKeywords.length === 0 ||
    !hasResidencyEvidence ||
    !hasEight ||
    !hasMonths
  ) {
    return invalidResult(
      "Unrecognized Document",
      "We couldn't verify this as a Certificate of Residency that confirms at least eight months of residency.",
      normalizedText,
      "UNRECOGNIZED_DOCUMENT",
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
    if (!text.trim() || confidence < MINIMUM_OCR_CONFIDENCE) {
      return invalidResult("Unreadable Image", UNREADABLE_DOCUMENT_MESSAGE, text, "LOW_CONFIDENCE");
    }
    return validateRecognizedText(documentType, text, options);
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
