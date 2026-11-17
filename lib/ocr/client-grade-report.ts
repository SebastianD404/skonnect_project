import { extractDocxTextFromBuffer } from "@/lib/skeap-document-keywords";
import {
  parseGradeReportText,
  type GradeReportDiagnostics,
} from "@/lib/grade-report-parser";

const MIN_OCR_CONFIDENCE = 85;
const MAX_PREPROCESSED_IMAGE_DIMENSION = 5000;

export type ClientGradeReportScan = {
  rawText: string;
  confidence: number;
  diagnostics: GradeReportDiagnostics;
  ocrStatus: "OCR_DONE" | "OCR_NEEDS_REVIEW";
};

type TesseractWorker = Awaited<ReturnType<typeof import("tesseract.js").createWorker>>;

async function preprocessGradeReportImage(source: Blob) {
  const bitmap = await createImageBitmap(source);
  try {
    const scale = Math.min(2, MAX_PREPROCESSED_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not create an image canvas for grade report OCR.");

    context.imageSmoothingQuality = "high";
    context.filter = "grayscale(1) contrast(1.4)";
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const result = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        canvas.width = 0;
        canvas.height = 0;
        if (blob) resolve(blob);
        else reject(new Error("Could not prepare the grade report image for OCR."));
      }, "image/png");
    });
    return result;
  } finally {
    bitmap.close();
  }
}

function extractPdfPageText(items: Array<{ str: string; transform: number[] }>) {
  const textLines = new Map<number, string[]>();
  for (const item of items) {
    if (!item.str.trim()) continue;
    const y = Math.round(item.transform[5] ?? 0);
    const line = textLines.get(y) ?? [];
    line.push(item.str);
    textLines.set(y, line);
  }

  return Array.from(textLines.entries())
    .sort(([firstY], [secondY]) => secondY - firstY)
    .map(([, line]) => line.join(" "))
    .join("\n");
}

async function renderPdfPage(page: import("pdfjs-dist").PDFPageProxy) {
  const viewport = page.getViewport({ scale: 1 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not render a grade report PDF page for OCR.");
  await page.render({ canvasContext: context, viewport }).promise;

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      canvas.width = 0;
      canvas.height = 0;
      if (blob) resolve(blob);
      else reject(new Error("Could not prepare a grade report PDF page for OCR."));
    }, "image/png");
  });
}

export async function scanGradeReportFile(file: File): Promise<ClientGradeReportScan> {
  let rawText = "";
  let confidence = 100;
  const workerState: { worker?: TesseractWorker } = {};
  const getWorker = async () => {
    if (!workerState.worker) {
      const { createWorker } = await import("tesseract.js");
      workerState.worker = await createWorker("eng");
    }
    return workerState.worker;
  };

  try {
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc =
        `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
      const documentProxy = await loadingTask.promise;
      const pages: string[] = [];
      const ocrConfidences: number[] = [];

      try {
        for (let pageNumber = 1; pageNumber <= documentProxy.numPages; pageNumber += 1) {
          const page = await documentProxy.getPage(pageNumber);
          try {
            const textContent = await page.getTextContent();
            const pageText = extractPdfPageText(
              textContent.items.filter(
                (item): item is typeof item & { str: string; transform: number[] } => "str" in item,
              ),
            ).trim();
            if (pageText.length >= 20) {
              pages.push(pageText);
              continue;
            }

            const renderedPage = await renderPdfPage(page);
            const normalizedImage = await preprocessGradeReportImage(renderedPage);
            const recognized = await (await getWorker()).recognize(normalizedImage);
            pages.push(recognized.data.text);
            ocrConfidences.push(recognized.data.confidence);
          } finally {
            page.cleanup();
          }
        }
      } finally {
        await documentProxy.destroy();
      }

      rawText = pages.join("\n");
      if (ocrConfidences.length) {
        confidence = ocrConfidences.reduce((sum, value) => sum + value, 0) / ocrConfidences.length;
      }
    } else if (
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      /\.docx$/i.test(file.name)
    ) {
      rawText = extractDocxTextFromBuffer(new Uint8Array(await file.arrayBuffer()));
      confidence = rawText ? 100 : 0;
    } else if (file.type.startsWith("image/") || /\.(jpe?g|jfif|png|webp)$/i.test(file.name)) {
      const imageSource = file.type === "image/jfif" || /\.jfif$/i.test(file.name)
        ? file.slice(0, file.size, "image/jpeg")
        : file;
      const normalizedImage = await preprocessGradeReportImage(imageSource);
      const recognized = await (await getWorker()).recognize(normalizedImage);
      rawText = recognized.data.text;
      confidence = recognized.data.confidence;
    } else {
      confidence = 0;
    }
  } finally {
    if (workerState.worker) await workerState.worker.terminate();
  }

  const parsed = parseGradeReportText(rawText);
  const diagnostics: GradeReportDiagnostics = {
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
  const ocrStatus =
    confidence >= MIN_OCR_CONFIDENCE &&
    parsed.rows.length > 0 &&
    parsed.unrecognizedRows.length === 0 &&
    parsed.gwa !== null &&
    !parsed.requiresStrictManualReview
      ? "OCR_DONE"
      : "OCR_NEEDS_REVIEW";

  return { rawText, confidence, diagnostics, ocrStatus };
}
