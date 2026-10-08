import { createRequire } from "node:module";
import sharp from "sharp";
import Tesseract from "tesseract.js";
import { parseGradeReportText } from "@/lib/grade-report-parser";
import {
  GRADE_REPORT_MIME_TYPES,
  hasGradeReportSignature,
  MAX_GRADE_REPORT_BYTES,
} from "@/lib/ocr/grade-report-file";

const MAX_PDF_PAGES = 10;
const MIN_OCR_CONFIDENCE = 65;
const MAX_IMAGE_WIDTH = 3600;
const MAX_IMAGE_HEIGHT = 5000;
const DEFAULT_IMAGE_WIDTH = 2600;
const require = createRequire(`${process.cwd()}/package.json`);

function loadCanvas() {
  return require("@napi-rs/canvas") as typeof import("@napi-rs/canvas");
}

export type GradeReportOcrStatus = "OCR_DONE" | "OCR_NEEDS_REVIEW";

export type GradeReportOcrResult = {
  status: GradeReportOcrStatus;
  rawText: string;
  parsed: ReturnType<typeof parseGradeReportText>;
  confidence: number;
};

export function decideGradeReportOcrStatus(
  rowCount: number,
  unrecognizedRowCount: number,
  confidence: number
): GradeReportOcrStatus {
  return rowCount === 0 ||
    unrecognizedRowCount > 0 ||
    confidence < MIN_OCR_CONFIDENCE
    ? "OCR_NEEDS_REVIEW"
    : "OCR_DONE";
}

function isPdf(bytes: Uint8Array) {
  return bytes.length >= 5 && new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-";
}

async function preprocessImage(image: Buffer) {
  const metadata = await sharp(image).metadata();
  const sourceWidth = metadata.width ?? DEFAULT_IMAGE_WIDTH;
  const dpiScaledWidth =
    metadata.density && metadata.density > 0
      ? Math.ceil(sourceWidth * (300 / metadata.density))
      : DEFAULT_IMAGE_WIDTH;
  const width = Math.min(MAX_IMAGE_WIDTH, Math.max(sourceWidth, dpiScaledWidth));

  return sharp(image)
    .rotate()
    .grayscale()
    .normalize()
    .resize({
      width,
      height: MAX_IMAGE_HEIGHT,
      fit: "inside",
      withoutEnlargement: false,
    })
    .linear(1.25, -20)
    .threshold(165)
    .png()
    .toBuffer();
}

async function rasterizePdf(pdfBuffer: Buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    useSystemFonts: true,
    disableFontFace: true,
  });
  const document = await loadingTask.promise;

  try {
    if (document.numPages > MAX_PDF_PAGES) {
      throw new Error(`PDFs are limited to ${MAX_PDF_PAGES} pages for OCR processing.`);
    }

    const pages: Buffer[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const originalViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(
        300 / 72,
        MAX_IMAGE_WIDTH / originalViewport.width,
        MAX_IMAGE_HEIGHT / originalViewport.height
      );
      const viewport = page.getViewport({ scale });
      const { createCanvas } = loadCanvas();
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext("2d");
      await page.render({
        // PDF.js accepts the node canvas context at runtime, but its type expects a DOM canvas.
        canvasContext: context as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise;
      pages.push(canvas.toBuffer("image/png"));
      page.cleanup();
    }
    return pages;
  } finally {
    await document.destroy();
  }
}

export async function processGradeReportOcr(
  input: Buffer,
  contentType: string
): Promise<GradeReportOcrResult> {
  const normalizedContentType = contentType.toLowerCase().split(";")[0].trim();
  if (!GRADE_REPORT_MIME_TYPES.has(normalizedContentType)) {
    throw new Error("Grade reports must be PDF, JPG, PNG, or WEBP files.");
  }
  if (input.byteLength === 0 || input.byteLength > MAX_GRADE_REPORT_BYTES) {
    throw new Error("The grade report is empty or exceeds the 10 MB limit.");
  }
  if (!hasGradeReportSignature(input, normalizedContentType)) {
    throw new Error("The uploaded file does not match its declared file type.");
  }

  const sourcePages = isPdf(input) ? await rasterizePdf(input) : [input];
  const worker = await Tesseract.createWorker("eng");

  try {
    const textPages: string[] = [];
    const pageConfidences: number[] = [];
    for (const sourcePage of sourcePages) {
      const preprocessed = await preprocessImage(sourcePage);
      const result = await worker.recognize(preprocessed);
      textPages.push(result.data.text);
      pageConfidences.push(result.data.confidence);
    }

    const rawText = textPages.join("\n");
    const parsed = parseGradeReportText(rawText);
    const confidence = pageConfidences.length
      ? Number(
          (
            pageConfidences.reduce((sum, value) => sum + value, 0) /
            pageConfidences.length
          ).toFixed(2)
        )
      : 0;

    return {
      status: decideGradeReportOcrStatus(
        parsed.rows.length,
        parsed.unrecognizedRows.length,
        confidence
      ),
      rawText,
      parsed,
      confidence,
    };
  } finally {
    await worker.terminate();
  }
}
