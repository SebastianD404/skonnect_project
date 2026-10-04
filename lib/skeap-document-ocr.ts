import { createWorker } from "tesseract.js";
import PizZip from "pizzip";
import { SKEAP_UPLOAD_KEY, type SkeapUploadKey } from "@/lib/skeap-upload";
import {
  DOCUMENT_KEYWORDS,
  extractDocxTextFromBuffer,
  getSkeapDocumentKeywordMatches,
} from "@/lib/skeap-document-keywords";

export type DocumentOCRResult =
  | { status: "verified"; extractedText: string; confidence: number }
  | { status: "review"; extractedText: string; confidence: number; reason: string }
  | { status: "skipped"; extractedText: ""; confidence: 0 };

const MINIMUM_CONFIDENCE = 50;

function isImageFile(file: File) {
  return file.type.startsWith("image/") || /\.(jpe?g|jfif|png|webp|gif|avif)$/i.test(file.name);
}

function isPdfFile(file: File) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function isDocxFile(file: File) {
  return file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    /\.docx$/i.test(file.name);
}

function extractDocxText(file: File): Promise<{ text: string; confidence: number; embeddedImages: Blob[] }> {
  return file.arrayBuffer().then((buffer) => {
    const zip = new PizZip(new Uint8Array(buffer));
    const text = extractDocxTextFromBuffer(new Uint8Array(buffer));

    const imageMimeTypes: Record<string, string> = {
      bmp: "image/bmp",
      gif: "image/gif",
      jpeg: "image/jpeg",
      jpg: "image/jpeg",
      png: "image/png",
      tif: "image/tiff",
      tiff: "image/tiff",
      webp: "image/webp",
    };
    const embeddedImages = Object.values(zip.files)
      .filter((entry) => !entry.dir && /^word\/media\/[^/]+$/i.test(entry.name))
      .flatMap((entry) => {
        const extension = entry.name.split(".").pop()?.toLowerCase() || "";
        const mimeType = imageMimeTypes[extension];
        return mimeType ? [new Blob([entry.asArrayBuffer()], { type: mimeType })] : [];
      });

    return { text, confidence: text ? 100 : 0, embeddedImages };
  });
}

async function normalizeImageForOCR(file: Blob): Promise<Blob> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0);

    const normalizedImage = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    return normalizedImage ?? file;
  } catch (error) {
    console.warn("Could not normalize SKEAP upload for text reading; trying the original image.", error);
    return file;
  } finally {
    bitmap?.close();
  }
}

async function extractPdfText(
  file: File,
  getWorker: () => Promise<Awaited<ReturnType<typeof createWorker>>>,
  imageUrls: string[]
): Promise<{ text: string; confidence: number }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
  let documentProxy: import("pdfjs-dist").PDFDocumentProxy | null = null;
  try {
    documentProxy = await loadingTask.promise;
    const pageTexts: string[] = [];
    const ocrConfidences: number[] = [];

    for (let pageNumber = 1; pageNumber <= documentProxy.numPages; pageNumber += 1) {
      const page = await documentProxy.getPage(pageNumber);
      try {
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .filter((item) => "str" in item)
          .map((item) => item.str)
          .join(" ")
          .trim();

        if (pageText) {
          pageTexts.push(pageText);
          continue;
        }

        if (typeof document === "undefined") {
          throw new Error("PDF page rendering requires a browser document.");
        }

        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not create a canvas for PDF OCR.");

        await page.render({ canvasContext: context, viewport }).promise;
        const renderedPage = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Could not convert a rendered PDF page for OCR."));
          }, "image/png");
        });
        canvas.width = 0;
        canvas.height = 0;

        const pageUrl = URL.createObjectURL(renderedPage);
        imageUrls.push(pageUrl);
        const recognition = await (await getWorker()).recognize(pageUrl);
        if (recognition.data.text.trim()) {
          pageTexts.push(recognition.data.text.trim());
          ocrConfidences.push(recognition.data.confidence);
        }
      } finally {
        page.cleanup();
      }
    }

    const text = pageTexts.join("\n").trim();
    const confidence = ocrConfidences.length
      ? ocrConfidences.reduce((sum, value) => sum + value, 0) / ocrConfidences.length
      : text
        ? 100
        : 0;
    return { text, confidence };
  } finally {
    if (documentProxy) await documentProxy.destroy();
    else await loadingTask.destroy();
  }
}

export async function validateDocumentOCR(
  file: File,
  docType: SkeapUploadKey
): Promise<DocumentOCRResult> {
  const keywords = DOCUMENT_KEYWORDS[docType];
  if (!keywords?.length || docType === SKEAP_UPLOAD_KEY.PHOTO || docType === SKEAP_UPLOAD_KEY.OTHER) {
    return { status: "skipped", extractedText: "", confidence: 0 };
  }

  const isPdf = isPdfFile(file);
  const isDocx = isDocxFile(file);
  if (!isImageFile(file) && !(isPdf && docType === SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE) && !isDocx) {
    return {
      status: "review",
      extractedText: "",
      confidence: 0,
      reason: "We couldn't check this file automatically.",
    };
  }

  const imageUrls: string[] = [];
  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  const getWorker = async () => {
    worker ??= await createWorker("eng");
    return worker;
  };

  try {
    let text: string;
    let confidence: number;
    let embeddedImages: Blob[] = [];

    if (isDocx) {
      ({ text, confidence, embeddedImages } = await extractDocxText(file));
    } else if (isPdf) {
      ({ text, confidence } = await extractPdfText(file, getWorker, imageUrls));
    } else {
      const normalizedImage = await normalizeImageForOCR(file);
      const imageUrl = URL.createObjectURL(normalizedImage);
      imageUrls.push(imageUrl);
      let recognition: Awaited<ReturnType<Awaited<ReturnType<typeof createWorker>>["recognize"]>>;
      try {
        recognition = await (await getWorker()).recognize(imageUrl);
      } catch (error) {
        if (normalizedImage === file) throw error;
        console.warn("Could not read normalized SKEAP upload; trying the original image.", error);
        const originalUrl = URL.createObjectURL(file);
        imageUrls.push(originalUrl);
        recognition = await (await getWorker()).recognize(originalUrl);
      }

      if (!recognition.data.text.trim() && normalizedImage !== file) {
        const originalUrl = URL.createObjectURL(file);
        imageUrls.push(originalUrl);
        recognition = await (await getWorker()).recognize(originalUrl);
      }

      text = recognition.data.text;
      confidence = recognition.data.confidence;
    }

    let hasMatch = getSkeapDocumentKeywordMatches(text, docType).length > 0;
    if (isDocx && !hasMatch && embeddedImages.length > 0) {
      const imageText: string[] = [];
      const imageConfidences: number[] = [];
      for (const image of embeddedImages) {
        const imageUrl = URL.createObjectURL(await normalizeImageForOCR(image));
        imageUrls.push(imageUrl);
        const result = await (await getWorker()).recognize(imageUrl);
        const recognizedText = result.data.text.trim();
        if (recognizedText) imageText.push(recognizedText);
        imageConfidences.push(result.data.confidence);
        text = [text, ...imageText].filter(Boolean).join("\n");
        hasMatch = getSkeapDocumentKeywordMatches(text, docType).length > 0;
        if (hasMatch) break;
      }
      confidence = imageConfidences.length
        ? imageConfidences.reduce((sum, value) => sum + value, 0) / imageConfidences.length
        : confidence;
    }

    if (!text.trim()) {
      return {
        status: "review",
        extractedText: text,
        confidence,
        reason: isPdf
          ? "This PDF may contain an image instead of selectable text. Upload the original JPG or PNG photo for automatic verification, or proceed to manual review."
          : "We couldn't read the text in this document. Please check the preview or proceed for review.",
      };
    }

    if (confidence <= MINIMUM_CONFIDENCE) {
      return {
        status: "review",
        extractedText: text,
        confidence,
        reason: "The text may be too blurry or unclear to verify.",
      };
    }

    if (!hasMatch) {
      return {
        status: "review",
        extractedText: text,
        confidence,
        reason: isPdf && text.trim().length < 20
          ? "This PDF may contain an image instead of readable text. Upload the original JPG or PNG photo for automatic verification, or proceed to manual review."
          : "The document text does not clearly match this upload slot.",
      };
    }

    return { status: "verified", extractedText: text, confidence };
  } catch (error) {
    console.warn("SKEAP upload could not be read automatically; manual review is available.", error);
    return {
      status: "review",
      extractedText: "",
      confidence: 0,
      reason: isPdf
        ? "This PDF could not be read automatically. Upload the original JPG or PNG photo for automatic verification, or proceed to manual review."
        : "We couldn't read this document automatically. Please check the preview or proceed for review.",
    };
  } finally {
    imageUrls.forEach((imageUrl) => URL.revokeObjectURL(imageUrl));
    await worker?.terminate();
  }
}
