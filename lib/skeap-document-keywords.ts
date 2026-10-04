import PizZip from "pizzip";
import { SKEAP_UPLOAD_KEY, type SkeapUploadKey } from "@/lib/skeap-upload";

const BIRTH_CERTIFICATE_KEYWORDS = [
  "birth certificate",
  "certificate of live birth",
  "philippine statistics authority",
  "national statistics office",
  "psa",
  "nso",
];

const VALID_ID_KEYWORDS = [
  "philsys",
  "philippine identification system",
  "philippine national id",
  "national id",
  "national identification card",
  "umid",
  "unified multi-purpose id",
  "school id",
  "student id",
  "driver's license",
  "drivers license",
  "postal id",
  "passport",
  "voter id",
  "voter's id",
  "voters id",
  "philhealth id",
  "tin id",
  "digital tin",
  "digital tin id",
  "taxpayer identification number",
  "tax identification number",
  "bureau of internal revenue",
];

const SCHOOL_ID_KEYWORDS = [
  "king's college of the philippines",
  "kings college of the philippines",
  "kcp",
  "pico road",
  "la trinidad",
  "benguet",
  "id no",
  "student",
  "registrar",
  "edna p. conchao",
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
    ...VALID_ID_KEYWORDS,
    ...SCHOOL_ID_KEYWORDS,
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
  const keywords = DOCUMENT_KEYWORDS[docType] ?? [];
  const normalizedText = normalizeOCRText(text);
  const foundKeywords = keywords.filter((keyword) =>
    normalizedText.includes(normalizeOCRText(keyword))
  );
  if (docType !== SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE) return foundKeywords;

  const birthCertificateMatches = foundKeywords.filter((keyword) =>
    BIRTH_CERTIFICATE_KEYWORDS.includes(keyword)
  );
  const validIdMatches = getKkProfilingValidIdMatches(text);
  return birthCertificateMatches.length > 0 || validIdMatches.length > 0
    ? foundKeywords
    : [];
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
