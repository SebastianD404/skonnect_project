import PizZip from "pizzip";
import { SKEAP_UPLOAD_KEY, type SkeapUploadKey } from "@/lib/skeap-upload";

const BIRTH_CERTIFICATE_KEYWORDS = [
  "birth certificate",
  "certificate of live birth",
  "live birth",
  "philippine statistics authority",
  "national statistics office",
  "psa",
  "nso",
  "office of the civil registrar general",
  "civil registrar general",
];

const BIRTH_RECORD_FIELD_KEYWORDS = [
  "date of birth",
  "place of birth",
  "name of child",
  "mother",
  "father",
  "sex",
  "date of registration",
  "registry number",
  "city or municipality",
];

const KK_VALID_ID_KEYWORDS = [
  "Republic of the Philippines",
  "Philippines",
  "Pilipinas",
  "Republika",
  "Filipino",
  "Filipina",
  "ID",
  "Identity",
  "Name",
  "Date of Birth",
  "Birth Date",
  "Address",
  "Sex",
  "Gender",
  "Male",
  "Female",
  "Civil Status",
  "Single",
  "Married",
  "Driver",
  "DRIVER",
  "License",
  "PHILHEALTH",
  "UMID",
  "TIN",
  "VOTER",
  "Student",
  "School",
  "University",
  "College",
  "Campus",
  "Pico",
  "La Trinidad",
  "Benguet",
  "Contact No",
  "Contact No.",
  "Emergency",
  "Information",
];

const KK_FRONT_ID_TERMS = [
  "Photo",
  "Nationality",
  "Height",
  "Weight",
  "License No",
  "Expiration Date",
  "Passport No",
  "ID Number",
  "ID No",
  "ID No.",
  "Card Number",
  "Name",
  "Student",
  "College",
  "University",
  "School",
];
const KK_CERTIFICATE_TERMS = [
  "Certificate of Residency",
  "certificate",
  "residency",
  "resident",
  "residing",
];

export const DOCUMENT_KEYWORDS: Partial<Record<SkeapUploadKey, string[]>> = {
  [SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE]: [
    ...BIRTH_CERTIFICATE_KEYWORDS,
  ],
  [SKEAP_UPLOAD_KEY.BARANGAY_RESIDENCY]: [
    "barangay",
    "residency",
    "certification",
    "clearance",
    "residente",
    "pico",
  ],
  [SKEAP_UPLOAD_KEY.ENROLLMENT_CERT]: [
    "certificate of enrollment",
    "registration form",
    "enrolled",
    "semester",
    "academic year",
    "school year",
    "notice of admission",
  ],
  [SKEAP_UPLOAD_KEY.GRADE_REPORT]: [
    "grade",
    "grades",
    "transcript",
    "gwa",
    "report of rating",
    "cor",
    "final rating",
  ],
  [SKEAP_UPLOAD_KEY.FAMILY_INCOME]: [
    "family income certificate",
    "income certificate",
    "annual income",
    "gross total income",
    "certificate of low income",
    "income tax return",
    "itr",
    "bureau of internal revenue",
    "bir",
    "form 2316",
    "form 1701",
    "certificate of tax exemption",
    "certificate of indigency",
    "certificate of indigence",
    "dswd",
    "social welfare",
  ],
  [SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE]: [
    "voter",
    "voters",
    "comelec",
    "certification",
    "registration",
    "precinct",
    "commission on elections",
    "republic of the philippines",
    "certificate of registration",
    "registered voter",
  ],
};

function normalizeOCRText(text: string) {
  return ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ")} `;
}

function getEditDistance(left: string, right: string) {
  if (Math.abs(left.length - right.length) > 1) return 2;

  let distance = 0;
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }

    distance += 1;
    if (distance > 1) return distance;
    if (left.length > right.length) leftIndex += 1;
    else if (right.length > left.length) rightIndex += 1;
    else {
      leftIndex += 1;
      rightIndex += 1;
    }
  }

  if (leftIndex < left.length || rightIndex < right.length) distance += 1;
  return distance;
}

function wordsMatchWithOCRNoise(actual: string, expected: string) {
  if (actual === expected) return true;
  if (expected.length < 5) return false;
  return getEditDistance(actual, expected) <= 1;
}

function phraseMatchesWithOCRNoise(text: string, phrase: string) {
  const textWords = normalizeOCRText(text).trim().split(" ");
  const phraseWords = phrase.split(" ");
  const minWindowSize = phraseWords.length > 2 ? phraseWords.length - 1 : phraseWords.length;
  const maxWindowSize = phraseWords.length + 1;

  for (let start = 0; start < textWords.length; start += 1) {
    for (let windowSize = minWindowSize; windowSize <= maxWindowSize; windowSize += 1) {
      const window = textWords.slice(start, start + windowSize);
      if (window.length !== windowSize) continue;

      let textIndex = 0;
      let phraseIndex = 0;
      let skippedTextWord = false;
      let skippedPhraseWord = false;
      while (textIndex < window.length && phraseIndex < phraseWords.length) {
        if (wordsMatchWithOCRNoise(window[textIndex], phraseWords[phraseIndex])) {
          textIndex += 1;
          phraseIndex += 1;
        } else if (!skippedTextWord && window.length > phraseWords.length) {
          skippedTextWord = true;
          textIndex += 1;
        } else if (
          !skippedPhraseWord &&
          phraseWords.length > window.length &&
          phraseWords.length > 2
        ) {
          skippedPhraseWord = true;
          phraseIndex += 1;
        } else {
          break;
        }
      }

      if (phraseIndex === phraseWords.length && textIndex === window.length) return true;
    }
  }

  return false;
}

function getBirthCertificateMatches(text: string) {
  const matches = BIRTH_CERTIFICATE_KEYWORDS.filter((keyword) => {
    if (keyword === "psa") return /\bpsa\b|\bp5a\b/i.test(text);
    if (keyword === "nso") return /\bnso\b|\bn5o\b/i.test(text);
    return phraseMatchesWithOCRNoise(text, keyword);
  });
  const matchedFields = BIRTH_RECORD_FIELD_KEYWORDS.filter((keyword) =>
    phraseMatchesWithOCRNoise(text, keyword)
  );

  if (matches.length > 0) return matches;
  const hasBirthDateField = matchedFields.includes("date of birth") ||
    matchedFields.includes("place of birth");
  const hasBothParentFields = matchedFields.includes("mother") && matchedFields.includes("father");
  return hasBirthDateField && hasBothParentFields
    ? matchedFields
    : [];
}

function findKkTerms(text: string, terms: string[]) {
  const normalizedText = text.toLowerCase();
  return terms.filter((term) => normalizedText.includes(term.toLowerCase()));
}

export function getKkProfilingValidIdMatches(text: string) {
  const genericMatches = findKkTerms(text, KK_VALID_ID_KEYWORDS);
  const frontMatches = findKkTerms(text, KK_FRONT_ID_TERMS);
  const hasCertificateTerms = findKkTerms(text, KK_CERTIFICATE_TERMS).length > 0;
  const hasGenericId = genericMatches.length >= 2;
  const hasSchoolIdText = /\b(student|college|university|school|id no\.?|id\s*no\.?|id number)\b/i.test(text);
  const isFrontId = frontMatches.length >= 1;
  const isValidId = !hasCertificateTerms && (hasGenericId || hasSchoolIdText) && (isFrontId || hasSchoolIdText);

  return isValidId ? genericMatches : [];
}

export function getSkeapDocumentKeywordMatches(text: string, docType: SkeapUploadKey) {
  if (docType === SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE) {
    return getBirthCertificateMatches(text);
  }

  const keywords = DOCUMENT_KEYWORDS[docType] ?? [];
  return keywords.filter((keyword) =>
    phraseMatchesWithOCRNoise(text, normalizeOCRText(keyword).trim())
  );
}

export function extractDocxTextFromBuffer(buffer: ArrayBuffer | Uint8Array) {
  const zip = new PizZip(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer));
  const wordXmlFiles = Object.values(zip.files).filter((entry) =>
    !entry.dir && /^word\/(?:document|header\d*|footer\d*)\.xml$/i.test(entry.name)
  );
  if (!wordXmlFiles.some((entry) => entry.name.toLowerCase() === "word/document.xml")) {
    throw new Error("The DOCX file does not contain a readable document body.");
  }

  return wordXmlFiles
    .flatMap((entry) => Array.from(entry.asText().matchAll(/<[\w.-]+:t(?:\s[^>]*)?>([\s\S]*?)<\/[\w.-]+:t\s*>/g), ([, value]) => value))
    .map((value) => value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, reference: string) => {
      if (reference.startsWith("#x")) {
        const codePoint = Number.parseInt(reference.slice(2), 16);
        return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
      }
      if (reference.startsWith("#")) {
        const codePoint = Number.parseInt(reference.slice(1), 10);
        return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
      }
      return { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'" }[reference.toLowerCase()] ?? entity;
    }))
    .join(" ")
    .trim();
}

const DOCX_IMAGE_EXTENSIONS = new Set(["bmp", "gif", "jpeg", "jpg", "png", "tif", "tiff", "webp"]);

export function extractDocxEmbeddedImages(buffer: ArrayBuffer | Uint8Array) {
  const zip = new PizZip(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer));
  return Object.values(zip.files)
    .filter((entry) => !entry.dir && /^word\/media\/[^/]+$/i.test(entry.name))
    .flatMap((entry) => {
      const extension = entry.name.split(".").pop()?.toLowerCase() || "";
      if (!DOCX_IMAGE_EXTENSIONS.has(extension)) return [];
      return [{
        name: entry.name,
        extension,
        data: entry.asUint8Array(),
      }];
    });
}
