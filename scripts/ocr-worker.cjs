const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");
const sharp = require("sharp");

const requireFromScript = createRequire(__filename);
const { createWorker, PSM } = requireFromScript("tesseract.js");

const ID_KEYWORDS = [
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

const FRONT_ID_TERMS = [
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

const BACK_ID_TERMS = [
  "Restrictions",
  "Restriction",
  "Endorsements",
  "Class",
  "Conditions",
  "Organ Donor",
  "Organ Donation",
  "Barcode",
  "QR",
  "Code",
  "Valid Until",
  "Authorized",
  "Approved",
  "Contact",
  "Information",
  "Rules",
  "Use",
  "Card",
  "Issued",
  "Office",
  "Emergency",
];

const CERTIFICATE_TERMS = [
  "Certificate of Residency",
  "Barangay Pico",
  "Pico",
  "resident",
  "residing",
  "Certificate",
  "Residency",
];

const CERTIFICATE_DOCUMENT_TERMS = [
  "Certificate of Residency",
  "certificate",
  "residency",
  "resident",
  "residing",
];

function normalizeText(text) {
  return text.toLowerCase();
}

function findMatches(text, keywords) {
  const normalized = normalizeText(text);
  return keywords.filter((keyword) => normalized.includes(keyword.toLowerCase()));
}

async function main() {
  const inputPath = process.argv[2];
  const documentType = process.argv[3];

  if (!inputPath || !documentType) {
    process.stdout.write(JSON.stringify({ success: false, isValid: false, matchedKeywords: [], error: "Missing input path or document type." }));
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(inputPath);
  const workerPath = path.resolve(process.cwd(), "node_modules", "tesseract.js", "src", "worker-script", "node", "index.js");
  const corePath = path.resolve(process.cwd(), "node_modules", "tesseract.js-core", "tesseract-core.wasm.js");

  const worker = await createWorker("eng", 1, {
    workerPath,
    corePath,
  });

  try {
    await worker.load();
    await worker.reinitialize("eng");
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT.toString() });

    const processedBuffer = await sharp(fileBuffer)
      .grayscale()
      .normalize()
      .linear(1.5, -(128 * 1.5) + 128)
      .toBuffer();

    const { data } = await worker.recognize(processedBuffer);
    const rawText = String(data?.text || "");

    if (documentType === "front_id" || documentType === "back_id") {
      const genericMatches = findMatches(rawText, ID_KEYWORDS);
      const frontMatches = findMatches(rawText, FRONT_ID_TERMS);
      const backMatches = findMatches(rawText, BACK_ID_TERMS);
      // A school ID may legitimately mention Pico or Barangay Pico. Only
      // certificate-specific wording should exclude it from ID validation.
      const hasCertificateTerms = findMatches(rawText, CERTIFICATE_DOCUMENT_TERMS).length > 0;
      const strongFrontMatches = frontMatches.filter((match) => match.toLowerCase() !== "name");
      const looksLikeBackId = backMatches.length > 0 && strongFrontMatches.length === 0;

      const hasGenericId = genericMatches.length >= 2;
      const isFrontId = frontMatches.length >= 1;
      const isBackId = backMatches.length >= 1;
      const hasSchoolIdText = /\b(student|college|university|school|id no\.?|id\s*no\.?|id number)\b/i.test(rawText);
      const hasIdSignal = hasGenericId || hasSchoolIdText;

      // Relaxed validation rules: front IDs still require front-specific signals,
      // but back IDs can be accepted if they contain generic ID keywords plus
      // either explicit back-side terms or a reasonably long OCR output (many IDs
      // print terms on the back that aren't in our keyword list and OCR can be noisy).
      let isValidId = false;
      if (documentType === "front_id") {
        isValidId = hasIdSignal && !hasCertificateTerms && (isFrontId || hasSchoolIdText);
      } else {
        const longEnough = rawText.replace(/\s+/g, " ").trim().length >= 60;
        // Accept back ID when generic matches found and not a certificate, and
        // either explicit back terms found or the OCR output looks substantive.
        isValidId = hasIdSignal && !hasCertificateTerms && (isBackId || longEnough || !isFrontId);
      }

      const result = {
        success: true,
        isValid: isValidId,
        matchedKeywords: genericMatches,
        text: rawText,
        documentSide: looksLikeBackId ? "back" : "unknown",
      };
      process.stdout.write(JSON.stringify(result));
      return;
    }

    const matchedKeywords = findMatches(rawText, CERTIFICATE_TERMS);
    const hasGeneralTerm = matchedKeywords.length > 0;
    const hasEight = /\b(8|08|eight)\b/i.test(rawText);
    const hasMonths = /\b(months?|mos\.?)\b/i.test(rawText);
    const result = {
      success: true,
      isValid: hasGeneralTerm && hasEight && hasMonths,
      matchedKeywords,
      text: rawText,
    };

    process.stdout.write(JSON.stringify(result));
  } catch (error) {
    process.stdout.write(JSON.stringify({ success: false, isValid: false, matchedKeywords: [], error: String(error instanceof Error ? error.message : error) }));
  } finally {
    await worker.terminate();
  }
}

main().catch((error) => {
  process.stdout.write(JSON.stringify({ success: false, isValid: false, matchedKeywords: [], error: String(error instanceof Error ? error.message : error) }));
});
