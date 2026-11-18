import { doesOcrTextMatchName } from "@/lib/ocrNameVerification";
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
const MINIMUM_OCR_CONFIDENCE = 30;
const MAX_ID_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const OCR_WORDS_TO_NORMALIZE = [
  "IDENTIFICATION", "UNIVERSITY", "PHILIPPINES", "STUDENT", "COLLEGE", "CAMPUS",
  "REPUBLIC", "PASSPORT", "EMERGENCY", "ADDRESS", "BIRTHDATE", "CONTACT",
  "PHILSYS", "BARANGAY", "REGISTRAR", "VOTER", "POSTAL", "DRIVER", "SCHOOL",
  "BIRTH", "DATE", "NAME", "CARD", "UMID", "TIN", "SSS", "PRC", "ID", "NO",
];
const WORKER_PATH =
  "https://cdn.jsdelivr.net/npm/tesseract.js@v7.0.0/dist/worker.min.js";
const CORE_PATH =
  "https://cdn.jsdelivr.net/npm/tesseract.js-core@v7.0.0";
const LANGUAGE_PATH =
  "https://cdn.jsdelivr.net/gh/naptha/tessdata@gh-pages/4.0.0_best_int";

const ID_KEYWORDS = [
  "Republic", "Philippines", "Pilipinas", "Republika", "PhilSys", "Driver", "Passport",
  "UMID", "Voter", "Postal", "TIN", "SSS", "PRC", "Student", "School", "University",
  "College", "Campus", "ID No", "ID Number", "Identification", "Identity", "Card",
  "Name", "Date of Birth", "Birth Date", "Birthdate", "Address", "Contact", "Emergency",
  "Sex", "Gender", "Male", "Female", "Civil Status", "License", "PHILHEALTH",
  "Pico", "La Trinidad", "Benguet", "Information", "Signature", "Registrar", "Barangay",
  "Valid", "Issued", "Specimen",
];
const FRONT_ID_TERMS = [
  "Photo", "Nationality", "Height", "Weight", "License No", "Expiration Date",
  "Passport", "ID Number", "ID No", "Card Number", "Identification", "Republic",
  "Philippines", "PhilSys", "Driver", "UMID", "Voter", "Postal", "TIN", "SSS", "PRC",
  "Student", "College", "University", "School", "Campus",
];
const BACK_ID_TERMS = [
  "ID", "Student", "Identification", "Magnetic Stripe", "Stripe Code", "Restrictions",
  "Restriction", "Endorsements", "Organ Donor", "Organ Donation", "Barcode", "QR Code",
  "Emergency", "Contact", "Signature", "Rules", "Address", "Birth Date", "Birthdate",
  "Registrar", "Barangay", "Valid", "Issued", "No.", "Specimen", "Name", "Card",
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

class InvalidIdImageError extends Error {}

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
    ` ${normalizeOcrText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ")} `;
  const normalized = normalize(text);
  return keywords.filter((keyword) => normalized.includes(normalize(keyword)));
}

export function normalizeOcrText(text: string) {
  let normalized = text;
  for (const word of OCR_WORDS_TO_NORMALIZE) {
    const spacedWordPattern = word.split("").join("\\s*");
    normalized = normalized.replace(
      new RegExp(`\\b${spacedWordPattern}\\b`, "gi"),
      word,
    );
  }
  return normalized.replace(/\b(?:[A-Za-z]\s+){1,}[A-Za-z]\b/g, (word) => word.replace(/\s+/g, ""));
}

export function hasBackIdVerificationEvidence(text: string) {
  const normalizedText = normalizeOcrText(text);
  return /\b(?:birth\s*date|birthdate|contact|address|emergency)\b/i.test(normalizedText);
}

function isIdDocument(documentType: NormalizedDocumentType) {
  return documentType === "front_id" || documentType === "back_id";
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

function needsReviewResult(text: string, errorCode: string, message?: string): ScanResult {
  return {
    success: false,
    status: "needs_review",
    badgeText: "For Verification",
    message: message ?? "This image will be checked by an SK Admin because its text could not be verified automatically.",
    isValid: false,
    matchedKeywords: [],
    text,
    errorCode,
  };
}

function getRegistrantNameTokenMatch(
  text: string,
  options?: OcrValidationOptions,
) {
  const nameTokens = [options?.firstName, options?.lastName]
    .flatMap((name) => normalizeOcrText(name ?? "").toLowerCase().split(/[^a-z]+/))
    .filter((token) => token.length >= 3);
  if (nameTokens.length === 0) return false;

  const textTokens = new Set(
    normalizeOcrText(text).toLowerCase().split(/[^a-z]+/).filter(Boolean),
  );
  return nameTokens.some((token) => {
    if (textTokens.has(token)) return true;
    const spacedTokenPattern = token.split("").join("\\s*");
    return new RegExp(`(?:^|[^a-z])${spacedTokenPattern}(?=$|[^a-z])`, "i").test(text);
  });
}

export function validateRecognizedText(
  documentType: DocumentType,
  text: string,
  options?: OcrValidationOptions,
): ScanResult {
  const normalizedDocumentType = normalizeDocumentType(documentType);
  const normalizedText = normalizeOcrText(text).trim();
  if (normalizedText.length < 10) {
    return isIdDocument(normalizedDocumentType)
      ? needsReviewResult(normalizedText, "LOW_CONFIDENCE")
      : invalidResult("Unreadable Image", UNREADABLE_DOCUMENT_MESSAGE, text, "LOW_CONFIDENCE");
  }

  if (isIdDocument(normalizedDocumentType)) {
    const matchedKeywords = findMatches(normalizedText, ID_KEYWORDS);
    const frontMatches = findMatches(normalizedText, FRONT_ID_TERMS);
    const backMatches = findMatches(normalizedText, BACK_ID_TERMS);
    const hasCertificateTerms = findMatches(normalizedText, CERTIFICATE_DOCUMENT_TERMS).length > 0;
    const hasIdCardAnchor = /\b(?:id|identification|student|card|registrar|barangay)\b/i.test(normalizedText);
    const hasSchoolIdText =
      /\b(?:student|college|university|school|campus|id\s*(?:no|number))\b/i.test(normalizedText);
    const hasBackVerificationEvidence = hasBackIdVerificationEvidence(normalizedText);
    const hasAcademicOrIdSignal = frontMatches.length > 0 || hasIdCardAnchor;
    const hasNameToken = getRegistrantNameTokenMatch(text, options);
    const isClearlyNonIdCertificate =
      hasCertificateTerms &&
      !/\b(?:id|identification|student|school|college|university|card)\b/i.test(normalizedText);
    const isValid = normalizedDocumentType === "front_id"
      ? (hasAcademicOrIdSignal || hasNameToken) && !isClearlyNonIdCertificate
      : !isClearlyNonIdCertificate &&
        (backMatches.length > 0 || hasBackVerificationEvidence || hasIdCardAnchor || hasSchoolIdText);

    if (!isValid) {
      return needsReviewResult(normalizedText, "UNRECOGNIZED_DOCUMENT");
    }

    if (
      normalizedDocumentType === "front_id" &&
      options?.firstName &&
      options.lastName
    ) {
      const nameMatched = getRegistrantNameTokenMatch(text, options) ||
        doesOcrTextMatchName(options.firstName, options.lastName, normalizedText);
      if (!nameMatched) {
        return {
          ...needsReviewResult(
            normalizedText,
            "NAME_MISMATCH",
            "The name on this ID could not be matched automatically. An SK Admin will verify it.",
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

async function recognizeFile(file: File, isIdScan: boolean) {
  const queuedScan = scanQueue.then(async () => {
    const worker = await getBrowserWorker();
    await worker.setParameters({ tessedit_pageseg_mode: "11" });
    const recognized = isIdScan
      ? await recognizeIdImage(worker, file)
      : [await worker.recognize(file)];
    const texts = recognized.map(({ data }) => normalizeOcrText(String(data.text ?? "")).trim()).filter(Boolean);
    return {
      text: texts.join("\n"),
      confidence: recognized.length > 0
        ? Math.max(...recognized.map(({ data }) => Number(data.confidence ?? 0)))
        : 0,
    };
  });
  scanQueue = queuedScan.then(() => undefined, () => undefined);
  return queuedScan;
}

async function canvasToPng(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not prepare the ID image for text scanning."));
    }, "image/png");
  });
}

async function recognizeIdImage(worker: BrowserOcrWorker, file: File) {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new InvalidIdImageError("The selected ID image could not be opened.");
  });
  const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = width;
  sourceCanvas.height = height;

  try {
    const context = sourceCanvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Could not prepare the ID image for text scanning.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const imageData = context.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    let minLuminance = 255;
    let maxLuminance = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const luminance = Math.round(
        0.299 * pixels[index] + 0.587 * pixels[index + 1] + 0.114 * pixels[index + 2],
      );
      pixels[index] = luminance;
      pixels[index + 1] = luminance;
      pixels[index + 2] = luminance;
      minLuminance = Math.min(minLuminance, luminance);
      maxLuminance = Math.max(maxLuminance, luminance);
    }

    if (maxLuminance - minLuminance < 12) {
      throw new InvalidIdImageError("The selected ID image appears blank.");
    }

    const range = Math.max(1, maxLuminance - minLuminance);
    const grayscalePixels = new Uint8ClampedArray(pixels.length);
    const invertedPixels = new Uint8ClampedArray(pixels.length);
    for (let index = 0; index < pixels.length; index += 4) {
      const gray = Math.max(0, Math.min(255, Math.round(((pixels[index] - minLuminance) / range) * 255)));
      grayscalePixels[index] = gray;
      grayscalePixels[index + 1] = gray;
      grayscalePixels[index + 2] = gray;
      grayscalePixels[index + 3] = 255;
      const inverted = 255 - gray;
      invertedPixels[index] = inverted;
      invertedPixels[index + 1] = inverted;
      invertedPixels[index + 2] = inverted;
      invertedPixels[index + 3] = 255;
    }

    const passCanvases = [document.createElement("canvas"), document.createElement("canvas")];
    try {
      const passPixels = [grayscalePixels, invertedPixels];
      const preparedFiles = await Promise.all(passCanvases.map(async (canvas, index) => {
        canvas.width = width;
        canvas.height = height;
        const passContext = canvas.getContext("2d");
        if (!passContext) throw new Error("Could not prepare the ID image for text scanning.");
        passContext.putImageData(new ImageData(passPixels[index], width, height), 0, 0);
        const blob = await canvasToPng(canvas);
        return new File([blob], `${file.name}-ocr-${index}.png`, { type: "image/png" });
      }));
      const standardResult = await worker.recognize(preparedFiles[0]);
      const invertedResult = await worker.recognize(preparedFiles[1]);
      return [standardResult, invertedResult];
    } finally {
      for (const canvas of passCanvases) {
        canvas.width = 0;
        canvas.height = 0;
      }
    }
  } finally {
    bitmap.close();
    sourceCanvas.width = 0;
    sourceCanvas.height = 0;
  }
}

export async function scanDocument(
  file: File,
  documentType: DocumentType,
  options?: OcrValidationOptions,
): Promise<ScanResult> {
  const normalizedDocumentType = normalizeDocumentType(documentType);
  const isId = isIdDocument(normalizedDocumentType);
  if (isId && file.size > MAX_ID_FILE_SIZE_BYTES) {
    return invalidResult("File Too Large", "ID images must be no larger than 10 MB.", "", "FILE_TOO_LARGE");
  }
  if (isId && file.size === 0) {
    return invalidResult("Invalid Image", "The selected ID image is empty.", "", "INVALID_IMAGE");
  }
  const isJfif = /\.jfif$/i.test(file.name);
  if (
    isId &&
    !["image/jpeg", "image/jpg", "image/png", "image/webp", "image/jfif"].includes(file.type.toLowerCase()) &&
    !isJfif
  ) {
    return invalidResult("Unsupported File", "Please upload a JPG/JFIF, PNG, or WebP ID image.", "", "INVALID_FILE_FORMAT");
  }

  try {
    const { text, confidence } = await recognizeFile(file, isId);
    if (!text.trim()) {
      return isId
        ? needsReviewResult("", "LOW_CONFIDENCE")
        : invalidResult("Unreadable Image", UNREADABLE_DOCUMENT_MESSAGE, text, "LOW_CONFIDENCE");
    }
    const result = validateRecognizedText(normalizedDocumentType, text, options);
    if (isId && confidence < MINIMUM_OCR_CONFIDENCE && result.status === "success") {
      return needsReviewResult(
        result.text,
        "LOW_CONFIDENCE",
        "The ID image is valid but its text is unclear. An SK Admin will verify it.",
      );
    }
    return result;
  } catch (error) {
    if (isId && error instanceof InvalidIdImageError) {
      return invalidResult("Invalid Image", error.message, "", "INVALID_IMAGE");
    }
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
    return isId
      ? needsReviewResult(
          "",
          "SCANNER_UNAVAILABLE",
          "This ID could not be checked automatically. An SK Admin will verify it.",
        )
      : invalidResult("Scanner Unavailable", SCANNER_UNAVAILABLE_MESSAGE, "", "SCANNER_UNAVAILABLE");
  }
}
