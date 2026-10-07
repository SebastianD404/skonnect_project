"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Upload } from "lucide-react";

type DropzoneStatus = "idle" | "error" | "success";

type SmartPortraitDropzoneProps = {
  uploadedUrl?: string;
  uploadedName?: string;
  invalid?: boolean;
  onFileSelected: (file: File) => Promise<void>;
};

export default function SmartPortraitDropzone({
  uploadedUrl,
  uploadedName,
  invalid = false,
  onFileSelected,
}: SmartPortraitDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  const uploadAttemptRef = useRef(0);
  const [status, setStatus] = useState<DropzoneStatus>(uploadedUrl ? "success" : "idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(uploadedUrl ?? null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(
    () => () => {
      uploadAttemptRef.current += 1;
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
    },
    []
  );

  function handlePhotoSelect(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please upload a valid image file.");
      setStatus("error");
      return;
    }

    const uploadAttempt = ++uploadAttemptRef.current;
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
    }
    const nextPreviewUrl = URL.createObjectURL(file);
    previewObjectUrlRef.current = nextPreviewUrl;
    setSelectedFile(file);
    setPreviewUrl(nextPreviewUrl);
    setStatus("success");
    setErrorMessage("");
    setIsUploading(true);

    void onFileSelected(file)
      .then(() => {
        if (uploadAttemptRef.current === uploadAttempt) setIsUploading(false);
      })
      .catch((error: unknown) => {
        if (uploadAttemptRef.current !== uploadAttempt) return;
        setIsUploading(false);
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Photo upload failed.");
      });
  }

  function openFilePicker() {
    inputRef.current?.click();
  }

  return (
    <div
      className="space-y-3"
      role="group"
      aria-label="Portrait photo upload"
      aria-describedby={status === "error" ? "portrait-upload-error" : undefined}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        handlePhotoSelect(event.dataTransfer.files[0]);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        data-required="profile"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          void handlePhotoSelect(event.currentTarget.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      {isUploading ? (
        <div className="flex h-[68px] animate-pulse items-center justify-between rounded-xl border border-blue-100 bg-blue-50/40 px-4" role="status">
          <div className="flex items-center gap-3">
            <LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-blue-600" aria-hidden="true" />
            <span className="text-xs font-medium text-blue-900">Processing photo...</span>
          </div>
          <span className="text-[11px] font-medium text-blue-600">Please wait</span>
        </div>
      ) : previewUrl ? (
        <div className={`flex min-w-0 items-center justify-between gap-3 rounded-xl border p-3 ${invalid ? "border-rose-300 bg-rose-50/30" : "border-slate-200 bg-slate-50"}`}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-300 bg-slate-200">
              <img src={previewUrl} alt="Portrait preview" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900" title={selectedFile?.name || uploadedName}>
                {selectedFile?.name || uploadedName || "Portrait photo"}
              </p>
              <div className="flex items-center gap-2">
                {selectedFile ? (
                  <span className="text-xs text-slate-500">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                ) : null}
                <a
                  href={uploadedUrl || previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                >
                  View file
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4M14 4h6m0 0v6m0-6-10 10" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={openFilePicker}
            className="shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            Change
          </button>
        </div>
      ) : (
        <div
          className={`flex items-center justify-between gap-3 rounded-xl border-2 border-dashed p-4 transition-colors ${
            isDragging ? "border-sky-500 bg-sky-50" : invalid ? "border-rose-300 bg-rose-50/30" : "border-slate-200 bg-slate-50/50"
          }`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <Upload className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="text-sm text-slate-600">
              {status === "error" ? errorMessage : "Upload a clear portrait photo."}
            </span>
          </div>
          <button
            type="button"
            onClick={openFilePicker}
            className="shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            Browse
          </button>
        </div>
      )}

      {status === "error" && previewUrl ? (
        <p id="portrait-upload-error" role="alert" className="text-xs text-rose-700">{errorMessage}</p>
      ) : null}
    </div>
  );
}