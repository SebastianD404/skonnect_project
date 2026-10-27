"use client";

import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, FileText, LoaderCircle, X, RefreshCw } from "lucide-react";
import { scanDocument } from "@/lib/ocrValidation";

export type DocumentOCRKey = "front" | "back" | "residency";

export type DocumentOCRState = {
  status: "idle" | "scanning" | "success" | "error" | "attached";
  badgeText?: string;
  message?: string;
  errorCode?: string;
  text?: string;
  parsedDates?: string[];
  birthdateMatched?: boolean;
  file?: File | null;
};

type DocumentOCRValidationExampleProps = {
  firstName?: string;
  middleInitial?: string;
  lastName?: string;
  initialFiles?: Partial<Record<DocumentOCRKey, File | null>>;
  showDebug?: boolean;
  profileBirthDate?: string;
  onFileSelected?: (key: DocumentOCRKey, file: File | null) => void;
  onValidationChange?: (state: Record<DocumentOCRKey, DocumentOCRState>) => void;
  onManualReviewAvailable?: (available: boolean) => void;
  onRemoveFile?: (key: DocumentOCRKey) => void;
  className?: string;
};

export default function DocumentOCRValidationExample({
  firstName,
  profileBirthDate,
  middleInitial,
  lastName,
  initialFiles,
  onFileSelected,
  onValidationChange,
  onManualReviewAvailable,
  onRemoveFile,
  showDebug = false,
  className,
}: DocumentOCRValidationExampleProps) {
  const [docs, setDocs] = useState<Record<DocumentOCRKey, DocumentOCRState>>({
    front: { status: "idle", file: null },
    back: { status: "idle", file: null },
    residency: { status: "idle", file: null },
  });
  const [previews, setPreviews] = useState<Record<DocumentOCRKey, string | null>>({
    front: null,
    back: null,
    residency: null,
  });
  const [previewErrors, setPreviewErrors] = useState<Record<DocumentOCRKey, boolean>>({
    front: false,
    back: false,
    residency: false,
  });
  const [previewLoading, setPreviewLoading] = useState<Record<DocumentOCRKey, boolean>>({
    front: false,
    back: false,
    residency: false,
  });
  const [modalKey, setModalKey] = useState<DocumentOCRKey | null>(null);
  const failedScanCountRef = useRef(0);

  const inputRefs = useRef<Record<DocumentOCRKey, HTMLInputElement | null>>({
    front: null,
    back: null,
    residency: null,
  });
  const restoredInitialFiles = useRef(false);
  const previewUrlsRef = useRef<Record<DocumentOCRKey, string | null>>({
    front: null,
    back: null,
    residency: null,
  });
  const previewGenerationRef = useRef<Record<DocumentOCRKey, number>>({
    front: 0,
    back: 0,
    residency: 0,
  });
  const previewFallbackAttemptedRef = useRef<Record<DocumentOCRKey, boolean>>({
    front: false,
    back: false,
    residency: false,
  });

  useEffect(() => () => {
    Object.values(previewUrlsRef.current).forEach((url) => {
      if (url) URL.revokeObjectURL(url);
    });
    previewUrlsRef.current = { front: null, back: null, residency: null };
  }, []);

  useEffect(() => {
    onValidationChange?.(docs);
  }, [docs, onValidationChange]);

  const recordFailedScan = () => {
    failedScanCountRef.current += 1;
    if (failedScanCountRef.current >= 2) {
      onManualReviewAvailable?.(true);
    }
  };

  const recordSuccessfulScan = () => {
    failedScanCountRef.current = 0;
    onManualReviewAvailable?.(false);
  };

  const setDoc = (key: DocumentOCRKey, patch: Partial<DocumentOCRState>) => {
    setDocs((d) => ({ ...d, [key]: { ...d[key], ...patch } }));
  };

  const isValidImageFile = (file: File) => {
    const imageTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp", "image/gif", "image/bmp", "image/tiff"];
    const extensionPattern = /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i;
    return imageTypes.includes(file.type) || extensionPattern.test(file.name);
  };

  const isPdfFile = (file: File) =>
    file.type === "application/pdf" || /\.pdf$/i.test(file.name);

  const clearInput = (key: DocumentOCRKey) => {
    const input = inputRefs.current[key];
    if (input) {
      input.value = "";
    }
  };

  const setPreviewUrl = (key: DocumentOCRKey, url: string | null) => {
    const previousUrl = previewUrlsRef.current[key];
    if (previousUrl && previousUrl !== url) URL.revokeObjectURL(previousUrl);
    previewUrlsRef.current[key] = url;
    setPreviews((current) => ({ ...current, [key]: url }));
    setPreviewErrors((current) => ({ ...current, [key]: false }));
  };

  const recoverPreview = async (key: DocumentOCRKey, file: File) => {
    if (previewFallbackAttemptedRef.current[key]) {
      setPreviewErrors((current) => ({ ...current, [key]: true }));
      return;
    }

    previewFallbackAttemptedRef.current[key] = true;
    const generation = previewGenerationRef.current[key];
    setPreviewLoading((current) => ({ ...current, [key]: true }));
    setPreviewErrors((current) => ({ ...current, [key]: true }));

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/programs/kk-profiling/preview", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`Preview conversion failed (${response.status}).`);
      }

      const previewBlob = await response.blob();
      if (!previewBlob.type.startsWith("image/")) {
        throw new Error("Preview conversion did not return an image.");
      }
      if (generation !== previewGenerationRef.current[key]) return;

      setPreviewUrl(key, URL.createObjectURL(previewBlob));
    } catch (error) {
      if (generation !== previewGenerationRef.current[key]) return;
      console.warn("Could not prepare a browser preview for the KK Profiling image.", {
        fileName: file.name,
        error,
      });
      setPreviewErrors((current) => ({ ...current, [key]: true }));
    } finally {
      if (generation === previewGenerationRef.current[key]) {
        setPreviewLoading((current) => ({ ...current, [key]: false }));
      }
    }
  };

  const clearPreview = (key: DocumentOCRKey) => setPreviewUrl(key, null);

  const openPreviewModal = (key: DocumentOCRKey) => {
    if (previews[key] && !previewErrors[key]) {
      setModalKey(key);
    }
  };

  const closePreviewModal = () => setModalKey(null);

  const handleInvalidFile = (key: DocumentOCRKey) => {
    previewGenerationRef.current[key] += 1;
    previewFallbackAttemptedRef.current[key] = false;
    clearInput(key);
    clearPreview(key);
    setPreviewLoading((current) => ({ ...current, [key]: false }));
    setDoc(key, {
      file: null,
      status: "error",
      message: "Please upload a PDF, JPG, PNG, or WebP file.",
      text: undefined,
      parsedDates: undefined,
      birthdateMatched: undefined,
    });
    onFileSelected?.(key, null);
  };

  async function processFile(file: File | null, key: DocumentOCRKey) {
    const generation = ++previewGenerationRef.current[key];
    previewFallbackAttemptedRef.current[key] = false;
    setPreviewLoading((current) => ({ ...current, [key]: false }));
    if (!file) {
      setPreviewUrl(key, null);
      setDoc(key, { file: null, status: "idle", message: undefined, text: undefined, parsedDates: undefined, birthdateMatched: undefined });
      onFileSelected?.(key, null);
      return;
    }

    if (isPdfFile(file)) {
      setPreviewUrl(key, null);
      onFileSelected?.(key, file);
      setDoc(key, {
        file,
        status: "attached",
        badgeText: "PDF Attached",
        message: "PDF Document Attached. It will be checked during application review.",
        text: undefined,
        parsedDates: undefined,
        birthdateMatched: undefined,
      });
      return;
    }

    if (!isValidImageFile(file)) {
      handleInvalidFile(key);
      return;
    }

    if (!(file instanceof Blob) || !file.type.startsWith("image/")) {
      setPreviewUrl(key, null);
    } else {
      const previewUrl = URL.createObjectURL(file);
      setPreviewUrl(key, previewUrl);
    }
    onFileSelected?.(key, file);
    setDoc(key, { file, status: "scanning", message: "Scanning document...", text: undefined });

    try {
      const docType = key === "residency" ? "certificate" : key === "front" ? "front_id" : "back_id";
      const result = await scanDocument(file, docType as never, {
        firstName: key === "front" || key === "residency" ? firstName : undefined,
        lastName: key === "front" || key === "residency" ? lastName : undefined,
        middleInitial: key === "front" ? middleInitial : undefined,
        profileBirthDate: key === "back" ? profileBirthDate : undefined,
      });

      if (generation !== previewGenerationRef.current[key]) return;
      if (result.status !== "success" || !result.isValid) {
        recordFailedScan();
      } else {
        recordSuccessfulScan();
      }
      setDoc(key, {
        status: result.status === "success" ? "success" : "error",
        badgeText: result.badgeText,
        message: result.message,
        errorCode: result.errorCode,
        text: result.text,
        parsedDates: Array.isArray(result.parsedDates) ? result.parsedDates : undefined,
        birthdateMatched: typeof result.birthdateMatched === "boolean" ? result.birthdateMatched : undefined,
      });
    } catch (err: unknown) {
      if (generation !== previewGenerationRef.current[key]) return;
      recordFailedScan();
      setDoc(key, {
        status: "error",
        badgeText: "Scanner Unavailable",
        errorCode: "SCANNER_UNAVAILABLE",
        message: String(err instanceof Error ? err.message : err) || "Unable to process this image. Please try again.",
        parsedDates: undefined,
        birthdateMatched: undefined,
      });
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>, key: DocumentOCRKey) {
    const file = e.target.files?.[0] ?? null;
    await processFile(file, key);
  }

  async function handleFileDrop(e: React.DragEvent<HTMLDivElement>, key: DocumentOCRKey) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0] ?? null;
    if (!file) return;
    await processFile(file, key);
  }

  useEffect(() => {
    if (restoredInitialFiles.current || !initialFiles) return;

    const filesToRestore = (Object.entries(initialFiles) as Array<[DocumentOCRKey, File | null]>)
      .filter(([, file]) => Boolean(file));
    if (filesToRestore.length === 0) return;

    restoredInitialFiles.current = true;
    void Promise.all(filesToRestore.map(([key, file]) => processFile(file, key)));
  }, [initialFiles]);

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>, key: DocumentOCRKey) {
    const file = e.clipboardData.files?.[0] ?? null;
    if (!file) return;
    e.preventDefault();
    handleInvalidFile(key);
  }

  const isAnyScanning = Object.values(docs).some((s) => s.status === "scanning");

  function renderInput(key: DocumentOCRKey, label: string) {
    const state = docs[key];
    const file = state.file;
    const isImageFile = Boolean(file && file.type.startsWith("image/"));
    const previewUrl = isImageFile && !previewErrors[key] ? previews[key] : null;
    const hasFile = Boolean(file);
    const isError = state.status === "error";
    const isSuccess = state.status === "success";
    const isScanning = state.status === "scanning";

    const handleImageClick = () => {
      if (isAttached && previewUrl) {
        window.open(previewUrl, "_blank", "noopener,noreferrer");
      } else if (hasFile) {
        openPreviewModal(key);
      } else {
        inputRefs.current[key]?.click();
      }
    };

    const isAttached = state.status === "attached";
    const showFeedback = isError || isAttached;
    const feedbackTitle = isError
      ? state.errorCode === "UNRECOGNIZED_DOCUMENT"
        ? "Unrecognized Document"
        : state.badgeText || "Unreadable image"
      : isAttached
      ? state.badgeText || "PDF attached"
      : "";
    const feedbackText = state.message;
    return (
      <div className="flex h-full flex-col rounded-2xl border-2 border-dashed border-gray-300 bg-white p-4 transition">
        <input
          id={`ocr-input-${key}`}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          ref={(el) => {
            inputRefs.current[key] = el;
          }}
          onChange={(e) => handleFileChange(e, key)}
          disabled={isAnyScanning}
          data-testid={`ocr-input-${key}`}
          className="hidden"
        />

        <div className="mb-3 flex w-full items-start justify-between">
          <div className="flex flex-col gap-1 text-left">
            <p className="text-sm font-semibold text-slate-900">{label}</p>
            <p className="text-xs text-slate-500">PDF, JPG, PNG, or WebP · Max 10MB</p>
          </div>
          {isSuccess ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Verified
            </span>
          ) : null}
        </div>

        <div
          className="relative mt-4 flex h-48 w-full cursor-pointer flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
          onClick={handleImageClick}
        >
          <div className="flex min-h-0 flex-1 items-center justify-center">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="ID Preview"
                className="h-full w-full object-contain"
                onError={() => {
                  if (file) void recoverPreview(key, file);
                }}
              />
            ) : file?.type === "application/pdf" ? (
              <div className="flex flex-col items-center text-slate-500">
                <FileText className="mb-2 h-8 w-8" aria-hidden="true" />
                <span>PDF file attached</span>
              </div>
            ) : file && previewLoading[key] ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" aria-hidden="true" />
                <span>Preparing preview…</span>
              </div>
            ) : (
              <div className="text-sm text-slate-400">
                {file ? "Image preview unavailable" : "No file selected"}
              </div>
            )}
          </div>
          {isScanning ? (
            <div
              role="status"
              aria-live="polite"
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/80 backdrop-blur-sm"
            >
              <LoaderCircle className="h-6 w-6 animate-spin text-slate-800" aria-hidden="true" />
              <span className="text-xs font-medium text-slate-700">Scanning document text...</span>
            </div>
          ) : null}
          {isError && feedbackText ? (
            <div className="flex w-full items-start gap-2 border-t border-amber-200 bg-amber-50 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
              <p className="text-xs leading-snug text-amber-900">
                <span className="font-medium">
                  {state.errorCode === "UNRECOGNIZED_DOCUMENT" ? "Unrecognized document." : `${feedbackTitle}.`}
                </span>{" "}
                {feedbackText}
              </p>
            </div>
          ) : null}
        </div>

        {isAttached && showFeedback && feedbackText ? (
          <div className="mt-4 flex items-center gap-3 rounded-lg bg-slate-100 px-3 py-2 text-slate-800">
            <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-semibold leading-5">{feedbackTitle}</p>
              <p className="text-xs leading-5 text-current/90">{feedbackText}</p>
            </div>
          </div>
        ) : null}

        {showDebug && state.parsedDates && state.parsedDates.length > 0 ? (
          <div className="mt-2 text-xs text-slate-600">
            <div><strong>Parsed dates:</strong> {state.parsedDates.join(", ")}</div>
            {typeof state.birthdateMatched === "boolean" ? (
              <div><strong>Birthdate matched:</strong> {state.birthdateMatched ? "yes" : "no"}</div>
            ) : null}
          </div>
        ) : null}

        {hasFile ? (
          <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-3 text-xs font-medium text-gray-700">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                inputRefs.current[key]?.click();
              }}
              disabled={isAnyScanning}
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              <RefreshCw className="h-4 w-4" />
              Upload a new photo
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clearInput(key);
                clearPreview(key);
                setDoc(key, { file: null, status: "idle", message: undefined, text: undefined, parsedDates: undefined, birthdateMatched: undefined });
                onFileSelected?.(key, null);
                onRemoveFile?.(key);
              }}
              disabled={isAnyScanning}
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
            >
              <X className="h-4 w-4" />
              Remove
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className={className} data-testid="ocr-validation-section">
        <div className="grid gap-3 md:grid-cols-2">
          {renderInput("front", "Front of Valid ID *")}
          {renderInput("back", "Back of Valid ID *")}
          <div className="md:col-span-2">{renderInput("residency", "Certificate of Residency *")}</div>
        </div>
        {isAnyScanning && <div className="sr-only">Processing document validation</div>}
      </div>
      {modalKey && previews[modalKey] && !previewErrors[modalKey] ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative max-h-full w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <button
              type="button"
              onClick={closePreviewModal}
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-900 shadow-md hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex h-full w-full items-center justify-center bg-white p-6">
              <img
                src={previews[modalKey] ?? ""}
                alt="Uploaded preview"
                className="max-h-[80vh] max-w-full rounded-3xl object-contain"
                onError={() => {
                  if (modalKey) {
                    setPreviewErrors((current) => ({ ...current, [modalKey]: true }));
                  }
                  setModalKey(null);
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
