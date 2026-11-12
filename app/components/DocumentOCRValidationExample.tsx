"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import Image from "next/image";
import { Clock3, FileText, LoaderCircle, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { scanDocument } from "@/lib/ocrValidation";

export type DocumentOCRKey = "front" | "back" | "residency";
export type OcrStrategy = "none" | "photo" | "residency" | "birth-certificate" | "front-id" | "back-id";
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
  scannerIsValid = true,
) {
  const normalizedText = text.toLowerCase();
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const characterCount = text.replace(/\s/g, "").length;

  switch (strategy) {
    case "photo":
      return wordCount > 4 || characterCount > 20
        ? { isValid: false, error: "Please upload a clear 2x2 portrait photo of your face. Avoid uploading documents or certificates here." }
        : { isValid: true, error: null };
    case "residency":
      return /\b(pico|residency)\b/i.test(normalizedText)
        ? { isValid: true, error: null }
        : { isValid: false, error: "This doesn't look like a valid certificate. Please check your file and try uploading again." };
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

function getScannerDocumentType(strategy: OcrStrategy): ScannerDocumentType | null {
  switch (strategy) {
    case "front-id":
      return "front_id";
    case "back-id":
      return "back_id";
    case "residency":
      return "certificate";
    case "photo":
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
  const generationRef = useRef(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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

    if (ocrStrategy === "none") {
      publishOcrState({ status: "idle", file });
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
      if (!evaluation.isValid && ocrStrategy === "photo") {
        onUpload(null);
      }
      if (!evaluation.isValid) {
        onFailedOcrAttempt?.();
      }
      publishOcrState(state);
    } catch {
      if (generation !== generationRef.current) return;
      const evaluation = evaluateDocumentOcr(ocrStrategy, "");
      if (ocrStrategy === "photo") onUpload(null);
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

  function chooseFile() {
    inputRef.current?.click();
  }

  function removeFile(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (inputRef.current) inputRef.current.value = "";
    void processFile(null);
  }

  const ocrFailed = ocrStrategy !== "none" && ocrStatus.status === "error";
  const isPdf = selectedFile?.type === "application/pdf";

  return (
    <>
      <div
        role="group"
        tabIndex={0}
        aria-label={`${selectedFile ? "Replace" : "Upload"} ${title}`}
        onClick={chooseFile}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            chooseFile();
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files?.[0];
          if (file) void processFile(file);
        }}
        className={`group flex h-[130px] min-h-[130px] flex-col justify-between overflow-hidden rounded-xl border p-4 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 ${
          ocrFailed
            ? "border-red-400 bg-red-50/60 hover:bg-red-50"
            : selectedFile
              ? "border-amber-500/50 bg-amber-50/30 hover:border-slate-400 hover:bg-slate-100/60"
              : "cursor-pointer border-dashed border-slate-300 bg-slate-50/50 hover:border-slate-400 hover:bg-slate-100/60"
        } ${selectedFile ? "cursor-default" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          aria-label={`Select ${title}`}
          className="hidden"
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0] ?? null;
            event.currentTarget.value = "";
            void processFile(file);
          }}
        />

        <div className="flex min-h-0 items-center gap-3">
          {selectedFile ? (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsPreviewOpen(true);
              }}
              aria-label={`View ${title}`}
              className="h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-white transition-opacity hover:opacity-90"
            >
              {previewUrl ? (
                <Image
                  src={previewUrl}
                  alt={`${title} thumbnail`}
                  width={64}
                  height={64}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              ) : (
                <FileText className="mx-auto h-7 w-7 text-slate-500" aria-hidden="true" />
              )}
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-sm font-medium text-slate-900">{title}</p>
              {selectedFile && !ocrFailed ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                  {ocrStatus.status === "scanning"
                    ? <LoaderCircle className="h-3 w-3 animate-spin" aria-hidden="true" />
                    : <Clock3 className="h-3 w-3" aria-hidden="true" />}
                  For Verification
                </span>
              ) : null}
            </div>
            <p className="truncate text-xs text-slate-500">
              {selectedFile ? "Original must be presented at the barangay." : `${acceptedFormats} · Max ${formatFileSize(maxSize)}`}
            </p>
            {selectedFile ? (
              <p className="truncate text-xs text-slate-700" title={selectedFile.name}>
                {selectedFile.name} · {formatFileSize(selectedFile.size)}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                chooseFile();
              }}
              aria-label={selectedFile ? `Replace ${title}` : `Upload ${title}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-100"
            >
              {selectedFile ? <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> : <Upload className="h-3.5 w-3.5" aria-hidden="true" />}
              {selectedFile ? "Replace" : "Upload"}
            </button>
            {selectedFile ? (
              <button
                type="button"
                onClick={removeFile}
                aria-label={`Remove ${title}`}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-red-600 shadow-sm hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
        <div className="h-8 overflow-hidden">
          {ocrFailed ? (
            <p role="alert" className="line-clamp-2 text-xs font-medium text-red-800">
              {ocrStatus.errorCode === "NAME_MISMATCH"
                ? "Name on ID does not match your account. Please replace with your own ID."
                : ocrStatus.message || "We couldn't check this file automatically. Our team will review it."}
            </p>
          ) : !selectedFile && fileError ? (
            <p role="alert" className="line-clamp-2 text-xs text-rose-700">{fileError}</p>
          ) : ocrStatus.status === "scanning" ? (
            <p role="status" className="flex items-center gap-1.5 text-xs text-slate-600">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Checking your file…
            </p>
          ) : null}
        </div>
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
