import { createWorker, PSM } from "tesseract.js";
import PizZip from "pizzip";
import { SKEAP_UPLOAD_KEY, type SkeapUploadKey } from "@/lib/skeap-upload";
import {
  DOCUMENT_KEYWORDS,
  extractDocxTextFromBuffer,
  getSkeapDocumentKeywordMatches,
  isSkeapFamilyIncomeDocument,
} from "@/lib/skeap-document-keywords";

export type DocumentOCRResult =
  | { status: "verified"; extractedText: string; confidence: number }
  | { status: "review"; extractedText: string; confidence: number; reason: string }
  | { status: "skipped"; extractedText: ""; confidence: 0 };

const MINIMUM_CONFIDENCE = 50;
const MINIMUM_BIRTH_CERTIFICATE_HEADING_CONFIDENCE = 30;
const STRONG_BIRTH_CERTIFICATE_MATCHES = new Set([
  "birth certificate",
  "certificate of live birth",
  "philippine statistics authority",
  "national statistics office",
  "office of the civil registrar general",
  "civil registrar general",
]);
const VOTER_CERTIFICATE_KEYWORDS = ["vote", "voter", "voters", "commissiononelections", "comelec"];

function hasDocumentKeyword(text: string, docType: SkeapUploadKey) {
  if (docType === SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE) {
    const normalizedText = text.toLowerCase().replace(/[^a-z0-9]/g, "");
    return VOTER_CERTIFICATE_KEYWORDS.some((keyword) => normalizedText.includes(keyword));
  }
  return getSkeapDocumentKeywordMatches(text, docType).length > 0;
}

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

export async function preprocessImageForOCR(file: Blob, binarize = false): Promise<Blob> {
  if (typeof document === "undefined") return file;

  const isWebp = file.type === "image/webp" ||
    ("name" in file && typeof file.name === "string" && /\.webp$/i.test(file.name));
  let bitmap: ImageBitmap | null = null;
  try {
    const canvas = document.createElement("canvas");
    let width: number;
    let height: number;
    let drawImage: (context: CanvasRenderingContext2D, width: number, height: number) => void;
    if (typeof createImageBitmap === "function") {
      try {
        bitmap = await createImageBitmap(file);
      } catch (error) {
        if (!isWebp) throw error;
      }
    }

    if (bitmap) {
      width = bitmap.width;
      height = bitmap.height;
      drawImage = (context, outputWidth, outputHeight) =>
        context.drawImage(bitmap!, 0, 0, outputWidth, outputHeight);
    } else if (isWebp) {
      const imageUrl = URL.createObjectURL(file);
      try {
        const image = new Image();
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error("Could not load the WebP image."));
          image.src = imageUrl;
        });
        width = image.naturalWidth;
        height = image.naturalHeight;
        drawImage = (context, outputWidth, outputHeight) =>
          context.drawImage(image, 0, 0, outputWidth, outputHeight);
      } finally {
        URL.revokeObjectURL(imageUrl);
      }
    } else {
      return file;
    }

    const scale = binarize
      ? Math.min(1.5, Math.max(1, 2400 / Math.max(width, height)))
      : 1;
    const outputWidth = Math.round(width * scale);
    const outputHeight = Math.round(height * scale);
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext("2d");
    if (!context) return file;
    drawImage(context, outputWidth, outputHeight);

    const imageData = context.getImageData(0, 0, outputWidth, outputHeight);
    const contrast = 1.5;
    for (let index = 0; index < imageData.data.length; index += 4) {
      const grayscale =
        imageData.data[index] * 0.299 +
        imageData.data[index + 1] * 0.587 +
        imageData.data[index + 2] * 0.114;
      const contrastAdjusted = Math.max(0, Math.min(255, (grayscale - 128) * contrast + 128));
      const enhanced = binarize
        ? contrastAdjusted < 175 ? 0 : 255
        : contrastAdjusted;
      imageData.data[index] = enhanced;
      imageData.data[index + 1] = enhanced;
      imageData.data[index + 2] = enhanced;
    }
    context.putImageData(imageData, 0, 0);

    const normalizedImage = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    canvas.width = 0;
    canvas.height = 0;
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
  docType: SkeapUploadKey,
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

        if (pageText) pageTexts.push(pageText);
        if (pageText && hasDocumentKeyword(pageText, docType)) continue;

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
  if (!isImageFile(file) && !isPdf && !isDocx) {
    return {
      status: "review",
      extractedText: "",
      confidence: 0,
      reason: "We couldn't check this file automatically.",
    };
  }

  const imageUrls: string[] = [];
  const workerRef: { current: Awaited<ReturnType<typeof createWorker>> | null } = {
    current: null,
  };
  const getWorker = async () => {
    workerRef.current ??= await createWorker("eng");
    return workerRef.current;
  };
  let currentStep = "starting the document reader";

  try {
    let text: string;
    let confidence: number;
    let embeddedImages: Blob[] = [];

    if (isDocx) {
      currentStep = "opening the Word document";
      ({ text, confidence, embeddedImages } = await extractDocxText(file));
    } else if (isPdf) {
      currentStep = "opening the PDF";
      ({ text, confidence } = await extractPdfText(file, docType, getWorker, imageUrls));
    } else {
      currentStep = "preparing the image";
      const normalizedImage = await preprocessImageForOCR(file);
      const recognizeImage = async (image: Blob) => {
        const imageUrl = URL.createObjectURL(image);
        imageUrls.push(imageUrl);
        currentStep = "reading the document text";
        return (await getWorker()).recognize(imageUrl);
      };

      let recognition: Awaited<ReturnType<Awaited<ReturnType<typeof createWorker>>["recognize"]>>;
      let originalWasRetried = false;
      try {
        recognition = await recognizeImage(normalizedImage);
      } catch (error) {
        if (normalizedImage === file) throw error;
        console.warn("Could not read the enhanced SKEAP upload; trying the original image.", error);
        recognition = await recognizeImage(file);
        originalWasRetried = true;
      }

      if (
        !originalWasRetried &&
        normalizedImage !== file &&
        (!recognition.data.text.trim() || !hasDocumentKeyword(recognition.data.text, docType))
      ) {
        const originalRecognition = await recognizeImage(file);
        if (
          hasDocumentKeyword(originalRecognition.data.text, docType) ||
          originalRecognition.data.confidence > recognition.data.confidence
        ) {
          recognition = originalRecognition;
        }
      }

      if (
        !hasDocumentKeyword(recognition.data.text, docType)
      ) {
        try {
          const ocrWorker = await getWorker();
          await ocrWorker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
          const sparseRecognition = await recognizeImage(file);
          if (
            hasDocumentKeyword(sparseRecognition.data.text, docType) ||
            sparseRecognition.data.confidence > recognition.data.confidence
          ) {
            recognition = sparseRecognition;
          }
        } catch (error) {
          console.warn("Sparse-text OCR retry failed; retaining the best available SKEAP recognition.", error);
        }
      }

      if (!hasDocumentKeyword(recognition.data.text, docType)) {
        try {
          const binarizedImage = await preprocessImageForOCR(file, true);
          if (binarizedImage !== file) {
            const ocrWorker = await getWorker();
            await ocrWorker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
            const binarizedRecognition = await recognizeImage(binarizedImage);
            if (
              hasDocumentKeyword(binarizedRecognition.data.text, docType) ||
              binarizedRecognition.data.confidence > recognition.data.confidence
            ) {
              recognition = binarizedRecognition;
            }
          }
        } catch (error) {
          console.warn("High-contrast OCR retry failed; retaining the best available SKEAP recognition.", error);
        }
      }

      text = recognition.data.text;
      confidence = recognition.data.confidence;
    }

    let hasMatch = hasDocumentKeyword(text, docType);
    if (isDocx && !hasMatch && embeddedImages.length > 0) {
      const imageText: string[] = [];
      const imageConfidences: number[] = [];
      for (const image of embeddedImages) {
        const imageUrl = URL.createObjectURL(await preprocessImageForOCR(image));
        imageUrls.push(imageUrl);
        const result = await (await getWorker()).recognize(imageUrl);
        const recognizedText = result.data.text.trim();
        if (recognizedText) imageText.push(recognizedText);
        imageConfidences.push(result.data.confidence);
        text = [text, ...imageText].filter(Boolean).join("\n");
        hasMatch = hasDocumentKeyword(text, docType);
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
          ? "This PDF may contain an image instead of selectable text. Upload the original JPG, PNG, or WebP photo for automatic verification, or proceed to manual review."
          : "We couldn't read the text in this document. Please check the preview or proceed for review.",
      };
    }

    const hasStrongBirthCertificateHeading =
      docType === SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE &&
      confidence > MINIMUM_BIRTH_CERTIFICATE_HEADING_CONFIDENCE &&
      getSkeapDocumentKeywordMatches(text, docType)
        .some((match) => STRONG_BIRTH_CERTIFICATE_MATCHES.has(match));

    if (
      confidence <= MINIMUM_CONFIDENCE &&
      docType !== SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE &&
      !hasStrongBirthCertificateHeading
    ) {
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
        reason: docType === SKEAP_UPLOAD_KEY.BARANGAY_RESIDENCY &&
          isSkeapFamilyIncomeDocument(text)
          ? "This appears to be a low-income or indigency certificate, not a Certificate of Residency. Upload the correct document or submit this file for administrator review."
          : isPdf && text.trim().length < 20
          ? "This PDF may contain an image instead of readable text. Upload the original JPG, PNG, or WebP photo for automatic verification, or proceed to manual review."
          : "The document text does not clearly match this upload slot.",
      };
    }

    return { status: "verified", extractedText: text, confidence };
  } catch (error) {
    const details = error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error);
    console.error("SKEAP upload could not be read automatically; manual review is available.", {
      fileName: file.name,
      documentType: docType,
      currentStep,
      error,
    });
    return {
      status: "review",
      extractedText: "",
      confidence: 0,
      reason: isPdf
        ? "This PDF could not be read automatically. Upload the original JPG, PNG, or WebP photo for automatic verification, or proceed to manual review."
        : `The document reader failed while ${currentStep} (${details}). Please try again or submit it for administrator review.`,
    };
  } finally {
    imageUrls.forEach((imageUrl) => URL.revokeObjectURL(imageUrl));
    try {
      await workerRef.current?.terminate();
    } catch (error) {
      console.warn("Could not cleanly stop the SKEAP OCR worker after validation.", error);
    }
  }
}
