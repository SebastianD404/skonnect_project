"use client";

import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle, UploadCloud, X, RefreshCw } from "lucide-react";
import { scanDocument } from "@/lib/ocrValidation";

export type DocumentOCRKey = "front" | "back" | "residency";

export type DocumentOCRState = {
  status: "idle" | "scanning" | "success" | "error";
  badgeText?: string;
  message?: string;
  text?: string;
  file?: File | null;
};

type DocumentOCRValidationExampleProps = {
  onFileSelected?: (key: DocumentOCRKey, file: File | null) => void;
  onValidationChange?: (state: Record<DocumentOCRKey, DocumentOCRState>) => void;
  onRemoveFile?: (key: DocumentOCRKey) => void;
  className?: string;
};

export default function DocumentOCRValidationExample({
  onFileSelected,
  onValidationChange,
  onRemoveFile,
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
  const [modalKey, setModalKey] = useState<DocumentOCRKey | null>(null);

  const inputRefs = useRef<Record<DocumentOCRKey, HTMLInputElement | null>>({
    front: null,
    back: null,
    residency: null,
  });

  useEffect(() => {
    onValidationChange?.(docs);
  }, [docs, onValidationChange]);

  const setDoc = (key: DocumentOCRKey, patch: Partial<DocumentOCRState>) => {
    setDocs((d) => ({ ...d, [key]: { ...d[key], ...patch } }));
  };

  const isValidImageFile = (file: File) => {
    const imageTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp", "image/gif", "image/bmp", "image/tiff"];
    const extensionPattern = /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i;
    return imageTypes.includes(file.type) || extensionPattern.test(file.name);
  };

  const clearInput = (key: DocumentOCRKey) => {
    const input = inputRefs.current[key];
    if (input) {
      input.value = "";
    }
  };

  const setPreviewUrl = (key: DocumentOCRKey, url: string | null) => {
    setPreviews((current) => {
      const previousUrl = current[key];
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }
      return { ...current, [key]: url };
    });
  };

  const clearPreview = (key: DocumentOCRKey) => setPreviewUrl(key, null);

  const openPreviewModal = (key: DocumentOCRKey) => {
    if (previews[key]) {
      setModalKey(key);
    }
  };

  const closePreviewModal = () => setModalKey(null);

  const handleInvalidFile = (key: DocumentOCRKey) => {
    clearInput(key);
    clearPreview(key);
    setDoc(key, {
      file: null,
      status: "error",
      message: "Only image files are accepted. Please upload JPG or PNG.",
      text: undefined,
    });
    onFileSelected?.(key, null);
  };

  async function processFile(file: File | null, key: DocumentOCRKey) {
    if (!file) {
      setPreviewUrl(key, null);
      setDoc(key, { file: null, status: "idle", message: undefined, text: undefined });
      onFileSelected?.(key, null);
      return;
    }

    if (!isValidImageFile(file)) {
      handleInvalidFile(key);
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setPreviewUrl(key, previewUrl);
    onFileSelected?.(key, file);
    setDoc(key, { file, status: "scanning", message: "Scanning document...", text: undefined });

    try {
      const docType = key === "residency" ? "certificate" : key === "front" ? "front_id" : "back_id";
      const result = await scanDocument(file, docType as never);

      setDoc(key, {
        status: result.status === "success" ? "success" : "error",
        badgeText: result.badgeText,
        message: result.message,
        text: result.text,
      });
    } catch (err: unknown) {
      setDoc(key, {
        status: "error",
        badgeText: "Unreadable Image",
        message: String(err instanceof Error ? err.message : err) || "Unable to process this image. Please try again.",
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

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>, key: DocumentOCRKey) {
    const file = e.clipboardData.files?.[0] ?? null;
    if (!file) return;
    e.preventDefault();
    handleInvalidFile(key);
  }

  const isAnyScanning = Object.values(docs).some((s) => s.status === "scanning");

  function renderInput(key: DocumentOCRKey, label: string) {
    const state = docs[key];
    const previewUrl = previews[key];
    const hasFile = Boolean(state.file);
    const isError = state.status === "error";
    const isSuccess = state.status === "success";
    const isScanning = state.status === "scanning";

    const handleImageClick = () => {
      if (hasFile) {
        openPreviewModal(key);
      } else {
        inputRefs.current[key]?.click();
      }
    };

    const showFeedback = isSuccess || isError || isScanning;
    const feedbackTitle = isSuccess
      ? state.badgeText || "Document verified"
      : isError
      ? state.badgeText || "Unreadable image"
      : "Scanning document";
    const feedbackText = state.message;
    const feedbackClasses = isSuccess
      ? "bg-emerald-50 text-emerald-900"
      : isError
      ? "bg-amber-50/80 text-amber-900"
      : "bg-slate-50 text-slate-900";

    return (
      <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-4 transition">
        <input
          id={`ocr-input-${key}`}
          type="file"
          accept="image/*"
          ref={(el) => {
            inputRefs.current[key] = el;
          }}
          onChange={(e) => handleFileChange(e, key)}
          data-testid={`ocr-input-${key}`}
          className="hidden"
        />

        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          <p className="text-xs text-slate-500">JPG or PNG · Max 10MB</p>
        </div>

        <div
          className={`mt-4 overflow-hidden rounded-xl bg-slate-100 ${hasFile ? "cursor-pointer" : "cursor-pointer"}`}
          onClick={handleImageClick}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={`${label} preview`}
              className="h-[200px] w-full object-cover"
            />
          ) : (
            <div className="flex h-[200px] items-center justify-center text-sm text-slate-500">
              No file selected
            </div>
          )}
        </div>

        {showFeedback && feedbackText ? (
          <div className={`mt-4 flex gap-3 rounded-xl px-3 py-2 ${feedbackClasses}`}>
            <span className="mt-1 text-slate-700">
              {isSuccess ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            </span>
            <div>
              <p className="text-sm font-semibold leading-5">{feedbackTitle}</p>
              <p className="text-xs leading-5 text-current/80">{feedbackText}</p>
            </div>
          </div>
        ) : null}

        {hasFile ? (
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-700 font-medium">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                inputRefs.current[key]?.click();
              }}
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
                setDoc(key, { file: null, status: "idle", message: undefined, text: undefined });
                onFileSelected?.(key, null);
                onRemoveFile?.(key);
              }}
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
      {modalKey && previews[modalKey] ? (
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
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
