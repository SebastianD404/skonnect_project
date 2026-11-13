"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type MouseEvent } from "react";
import Image from "next/image";
import { AlertCircle, Clock3, FileText, LoaderCircle, UploadCloud, X } from "lucide-react";
import { scanDocument } from "@/lib/ocrValidation";

export type DocumentOCRKey = "front" | "back" | "residency";
export type OcrStrategy = "none" | "residency" | "birth-certificate" | "front-id" | "back-id";
type ScannerDocumentType = "front_id" | "back_id" | "certificate";

export type DocumentOCRState = {
  status: "idle" | "scanning" | "success" | "error";
  badgeText?: string;
  message?: string;
  errorCode?: string;
  text?: string;
  parsedDates?: string[];
  birthdateMatched?: boolean;
  file?: File | null;
};

type DocumentUploadCardProps = {
  title: string;
  acceptedFormats: string;
  accept: string;
  maxSize: number;
  ocrStrategy: OcrStrategy;
  helperText?: string;
  compact?: boolean;
  onUpload: (file: File | null) => void;
  initialFile?: File | null;
  firstName?: string;
  middleInitial?: string;
  lastName?: string;
  profileBirthDate?: string;
  onOcrStateChange?: (state: DocumentOCRState) => void;
  onFailedOcrAttempt?: () => void;
};

export function evaluateDocumentOcr(
  strategy: OcrStrategy,
  text: string,
  scannerIsValid = false,
) {
  const normalizedText = text.toLowerCase();

  switch (strategy) {
    case "residency":
      return scannerIsValid
        ? { isValid: true, error: null }
        : {
            isValid: false,
            error: "This doesn't appear to be a Certificate of Residency issued by Barangay Pico. Please upload the correct document.",
          };
    case "birth-certificate":
      return /\b(birth|registry)\b/i.test(normalizedText)
        ? { isValid: true, error: null }
        : { isValid: false, error: "This doesn't look like a valid certificate. Please check your file and try uploading again." };
    case "front-id":
    case "back-id":
      return scannerIsValid
        ? { isValid: true, error: null }
        : { isValid: false, error: "We couldn't check this file automatically. Our team will review it." };
    case "none":
      return { isValid: true, error: null };
  }
}

export function getCompactIdErrorMessage(
  strategy: Extract<OcrStrategy, "front-id" | "back-id">,
  errorCode?: string,
) {
  const side = strategy === "front-id" ? "front" : "back";

  switch (errorCode) {
    case "NAME_MISMATCH":
      return "Please upload your own ID.";
    case "WRONG_DOCUMENT_SIDE":
      return `Please upload the ${side} of your ID.`;
    case "BIRTHDATE_MISMATCH":
      return "Please check the birth date on your ID.";
    case "SCANNER_UNAVAILABLE":
      return "This ID could not be checked. It will be reviewed manually.";
    case "LOW_CONFIDENCE":
      return `Please upload a clearer copy of the ${side} of your ID.`;
    case "UNRECOGNIZED_DOCUMENT":
      return `Please upload the ${side} of a valid ID.`;
    default:
      return "Please upload a valid ID.";
  }
}

function getScannerDocumentType(strategy: OcrStrategy): ScannerDocumentType | null {
  switch (strategy) {
    case "front-id":
      return "front_id";
    case "back-id":
      return "back_id";
    case "residency":
      return "certificate";
    case "birth-certificate":
      return "front_id";
    case "none":
      return null;
  }
}

async function scanBirthCertificatePdf(file: File) {
  const pdfjs = await import("pdfjs-dist");
  if ("Worker" in window) {
    pdfjs.GlobalWorkerOptions.workerSrc =
      `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  }

  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
  let pdf: Awaited<typeof loadingTask.promise> | null = null;
  try {
    pdf = await loadingTask.promise;
    const recognizedTexts: string[] = [];
    const maxPages = Math.min(pdf.numPages, 3);

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      try {
        const textContent = await page.getTextContent();
        const embeddedText = textContent.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
          .trim();
        if (embeddedText) recognizedTexts.push(embeddedText);

        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not prepare the birth certificate page for text scanning.");

        await page.render({ canvasContext: context, viewport }).promise;
        const imageBlob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Could not prepare the birth certificate page for text scanning."));
          }, "image/png");
        });
        canvas.width = 0;
        canvas.height = 0;

        const imageFile = new File([imageBlob], `birth-certificate-page-${pageNumber}.png`, {
          type: "image/png",
        });
        const result = await scanDocument(imageFile, "front_id");
        if (result.text) recognizedTexts.push(result.text);
      } finally {
        page.cleanup();
      }
    }

    return recognizedTexts.join("\n");
  } finally {
    if (pdf) await pdf.destroy();
    else await loadingTask.destroy();
  }
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentUploadCard({
  title,
  acceptedFormats,
  accept,
  maxSize,
  ocrStrategy,
  helperText,
  compact = false,
  onUpload,
  initialFile,
  firstName,
  middleInitial,
  lastName,
  profileBirthDate,
  onOcrStateChange,
  onFailedOcrAttempt,
}: DocumentUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const generationRef = useRef(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<DocumentOCRState>({
    status: "idle",
    file: null,
  });
  const [fileError, setFileError] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const previewUrl = useMemo(
    () => selectedFile ? URL.createObjectURL(selectedFile) : null,
    [selectedFile],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const publishOcrState = useCallback((state: DocumentOCRState) => {
    setOcrStatus(state);
    onOcrStateChange?.(state);
  }, [onOcrStateChange]);

  const processFile = useCallback(async (file: File | null) => {
    const generation = ++generationRef.current;
    setFileError(null);
    setSelectedFile(file);
    onUpload(file);

    if (!file) {
      publishOcrState({ status: "idle", file: null });
      return;
    }

    const acceptedTypes = accept
      .split(",")
      .map((type) => type.trim().toLowerCase())
      .filter((type) => type.startsWith("image/") || type.startsWith("application/"));
    if (!acceptedTypes.includes(file.type.toLowerCase())) {
      setSelectedFile(null);
      onUpload(null);
      setFileError(`Choose a file in these formats: ${acceptedFormats}.`);
      publishOcrState({ status: "error", message: "Unsupported file format.", file: null });
      return;
    }
    if (file.size === 0 || file.size > maxSize) {
      setSelectedFile(null);
      onUpload(null);
      setFileError(`File must be no larger than ${formatFileSize(maxSize)}.`);
      publishOcrState({ status: "error", message: "File exceeds the upload size limit.", file: null });
      return;
    }

    const shouldRunOcr =
      ocrStrategy === "birth-certificate" ||
      ocrStrategy === "residency" ||
      ocrStrategy === "front-id" ||
      ocrStrategy === "back-id";
    if (!shouldRunOcr) {
      publishOcrState({ status: "success", badgeText: "File validated", file });
      return;
    }
    if (!file.type.startsWith("image/") && !(file.type === "application/pdf" && ocrStrategy === "birth-certificate")) {
      const evaluation = evaluateDocumentOcr(ocrStrategy, "");
      publishOcrState({
        status: "error",
        message: evaluation.error ?? "We couldn't check this file automatically. Our team will review it.",
        file,
      });
      return;
    }

    publishOcrState({ status: "scanning", message: "Scanning document text…", file });
    try {
      const scannerType = getScannerDocumentType(ocrStrategy);
      if (!scannerType) return;
      const result = file.type === "application/pdf" && ocrStrategy === "birth-certificate"
        ? {
            text: await scanBirthCertificatePdf(file),
            status: "success" as const,
            isValid: true,
            badgeText: "Text extracted",
            message: "",
            errorCode: undefined,
            parsedDates: undefined,
            birthdateMatched: undefined,
          }
        : await scanDocument(file, scannerType, {
            firstName: ocrStrategy === "front-id" || ocrStrategy === "residency" ? firstName : undefined,
            lastName: ocrStrategy === "front-id" || ocrStrategy === "residency" ? lastName : undefined,
            middleInitial: ocrStrategy === "front-id" ? middleInitial : undefined,
            profileBirthDate: ocrStrategy === "back-id" ? profileBirthDate : undefined,
          });
      if (generation !== generationRef.current) return;

      const evaluation = evaluateDocumentOcr(
        ocrStrategy,
        result.text,
        result.status === "success" && result.isValid,
      );
      const state: DocumentOCRState = {
        status: evaluation.isValid ? "success" : "error",
        badgeText: result.badgeText,
        message: evaluation.error ?? result.message,
        errorCode: evaluation.error ? "DOCUMENT_STRATEGY_FAILED" : result.errorCode,
        text: result.text,
        parsedDates: result.parsedDates,
        birthdateMatched: result.birthdateMatched,
        file,
      };
      if (!evaluation.isValid) {
        onFailedOcrAttempt?.();
      }
      publishOcrState(state);
    } catch {
      if (generation !== generationRef.current) return;
      const evaluation = evaluateDocumentOcr(ocrStrategy, "");
      publishOcrState({
        status: "error",
        badgeText: "Scanner unavailable",
        message: evaluation.error ?? "We couldn't check this file automatically. Our team will review it.",
        errorCode: "SCANNER_UNAVAILABLE",
        file,
      });
    }
  }, [accept, acceptedFormats, firstName, lastName, maxSize, middleInitial, ocrStrategy, onFailedOcrAttempt, onUpload, profileBirthDate, publishOcrState]);

  useEffect(() => {
    if (initialFile && initialFile !== selectedFile) {
      const timer = window.setTimeout(() => void processFile(initialFile), 0);
      return () => window.clearTimeout(timer);
    }
  }, [initialFile, processFile, selectedFile]);

  function removeFile(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (inputRef.current) inputRef.current.value = "";
    void processFile(null);
  }

  const ocrFailed = ocrStrategy !== "none" && ocrStatus.status === "error";
  const isPdf = selectedFile?.type === "application/pdf";
  const displayFileName = selectedFile?.name.replace(/\.[^.]+$/, "") || selectedFile?.name;
  const hasImageBackground = Boolean(selectedFile && !isPdf && previewUrl);
  const detailedOcrErrorMessage = ocrFailed
    ? ocrStatus.errorCode === "NAME_MISMATCH"
      ? "Name on ID does not match your account. Please replace with your own ID."
      : ocrStatus.message || "We couldn't check this file automatically. Our team will review it."
    : null;
  const compactIdErrorMessage =
    compact && (ocrStrategy === "front-id" || ocrStrategy === "back-id") && ocrFailed
      ? getCompactIdErrorMessage(ocrStrategy, ocrStatus.errorCode)
      : null;
  const ocrErrorMessage = compactIdErrorMessage ?? detailedOcrErrorMessage;
  const ocrErrorTitle =
    compactIdErrorMessage && detailedOcrErrorMessage
      ? detailedOcrErrorMessage
      : ocrErrorMessage;
  const cardHeightClass = compact ? "min-h-32" : "min-h-52";
  const dropzoneStateClasses = selectedFile
    ? `border-2 border-dashed border-amber-400 ${hasImageBackground ? "bg-cover bg-center bg-no-repeat" : "bg-slate-700"}`
    : isDragging
      ? "border-2 border-dashed border-[var(--primary)] bg-slate-50 hover:border-[var(--primary)]"
      : "border-2 border-dashed border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50";

  return (
    <>
      <div
        aria-busy={ocrStatus.status === "scanning"}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setIsDragging(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) void processFile(file);
        }}
        className={`group relative flex ${cardHeightClass} flex-col items-center justify-center overflow-hidden rounded-xl text-center transition-colors duration-200 ${dropzoneStateClasses}`}
        style={hasImageBackground && previewUrl ? { backgroundImage: `url("${previewUrl}")` } : undefined}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          aria-label={`Select ${title}`}
          className="sr-only outline-none focus:outline-none focus:ring-0"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0] ?? null;
            event.currentTarget.value = "";
            void processFile(file);
          }}
        />
        {selectedFile ? (
          <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center">
            <button
              type="button"
              onClick={() => setIsPreviewOpen(true)}
              aria-label={`Preview ${title}: ${selectedFile.name}`}
              className={`flex w-full flex-1 cursor-zoom-in flex-col items-center justify-center text-center outline-none transition-all duration-150 ease-out active:scale-[0.99] focus:outline-none focus:ring-0 ${
                compact ? "px-2 py-1" : "px-4 py-2"
              } text-white`}
            >
              {isPdf ? <FileText className={`mb-1 text-white ${compact ? "h-4 w-4" : "h-6 w-6"}`} aria-hidden="true" /> : null}
              <p className={`font-semibold leading-tight text-white ${compact ? "text-xs" : "text-sm"}`}>
                {title}
              </p>
              {compact ? (
                <div className="mt-1 w-full min-w-0 text-white">
                  <p className="truncate text-[10px] leading-tight" title={selectedFile.name}>
                    {displayFileName}
                  </p>
                  <p className="text-[9px] leading-tight">{formatFileSize(selectedFile.size)}</p>
                </div>
              ) : (
                <p
                  className="mt-1 max-w-full whitespace-normal break-all text-xs text-white"
                  title={selectedFile.name}
                >
                  {displayFileName} · {formatFileSize(selectedFile.size)}
                </p>
              )}
              <span
                role={ocrStatus.status === "scanning" ? "status" : undefined}
                aria-live="polite"
                className={`inline-flex items-center gap-1 rounded-full border border-white/40 bg-white/15 font-semibold text-white ${compact ? "mt-1 px-2 py-0.5 text-[9px]" : "mt-1 px-2 py-0.5 text-[10px]"}`}
              >
                {ocrStatus.status === "scanning"
                  ? <LoaderCircle className="h-3 w-3 animate-spin text-white" aria-hidden="true" />
                  : <Clock3 className="h-3 w-3 text-white" aria-hidden="true" />}
                {ocrStatus.status === "scanning" ? "Checking file..." : "For Verification"}
              </span>
              {!compact ? (
                <p className="mt-1 text-xs leading-tight text-white/90">
                  Original must be presented at the barangay.
                </p>
              ) : null}
              {ocrErrorMessage ? (
                <p
                  role="alert"
                  className={`mt-1 flex w-full max-w-full items-start gap-1.5 rounded-md border border-amber-300/60 bg-[#0F3D5C]/90 px-2 text-left font-medium leading-snug text-white shadow-sm ${compact ? "py-1 text-[10px]" : "py-1.5 text-xs"}`}
                  title={ocrErrorTitle ?? undefined}
                >
                  <AlertCircle
                    className={`mt-0.5 shrink-0 text-amber-300 ${compact ? "h-3 w-3" : "h-3.5 w-3.5"}`}
                    aria-hidden="true"
                  />
                  <span className="whitespace-normal break-words">{ocrErrorMessage}</span>
                </p>
              ) : null}
            </button>
            <button
              type="button"
              onClick={removeFile}
              aria-label={`Remove ${title}`}
              title={`Remove ${title}`}
              className={`absolute right-2 top-2 z-20 inline-flex items-center justify-center rounded-full bg-white/90 text-slate-600 shadow-sm transition-colors hover:bg-white hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 ${compact ? "h-6 w-6" : "h-7 w-7"}`}
            >
              <X className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <label
            htmlFor={inputId}
            className={`flex min-h-0 w-full flex-1 cursor-pointer flex-col items-center justify-center overflow-hidden text-center outline-none transition-all duration-150 ease-out active:scale-[0.99] active:bg-slate-50/60 focus:outline-none focus:ring-0 focus-within:outline-none focus-within:ring-0 ${
              compact ? "p-2" : "p-3"
            }`}
          >
            <UploadCloud
              className={`mb-1 ${compact ? "h-5 w-5" : "h-6 w-6"} text-slate-400 transition-transform duration-150 group-hover:-translate-y-0.5 group-active:scale-90`}
              aria-hidden="true"
            />
            <p className="text-sm font-semibold text-slate-800">{title}</p>
            <p className="mt-1 text-xs text-slate-500">
              {acceptedFormats} · Max {formatFileSize(maxSize)}
            </p>
            {helperText ? (
              <p className="mt-1 rounded bg-blue-50 px-2 py-1 text-xs leading-tight text-blue-600/80">
                {helperText}
              </p>
            ) : null}
            {fileError ? (
              <p role="alert" className="mt-1 text-xs leading-tight text-rose-700">
                {fileError}
              </p>
            ) : null}
          </label>
        )}
        {hasImageBackground ? (
          <div aria-hidden="true" className="absolute inset-0 z-0 rounded-xl bg-slate-900/60" />
        ) : null}
      </div>

      {isPreviewOpen && selectedFile ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsPreviewOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setIsPreviewOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`${title} preview`}
            className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-slate-900">{title}</h2>
                <p className="truncate text-xs text-slate-500">{selectedFile.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                aria-label="Close preview"
                className="ml-4 rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-100 p-4">
              {isPdf && previewUrl ? (
                <iframe title={`${title} full preview`} src={previewUrl} className="h-[75vh] w-full rounded-lg bg-white" />
              ) : previewUrl ? (
                <Image
                  src={previewUrl}
                  alt={`${title} full preview`}
                  width={1600}
                  height={1200}
                  unoptimized
                  className="max-h-[75vh] max-w-full rounded-lg object-contain"
                />
              ) : (
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <FileText className="h-6 w-6" aria-hidden="true" />
                  Preview is unavailable for this file.
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
