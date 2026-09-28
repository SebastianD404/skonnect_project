"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Upload } from "lucide-react";

type DropzoneStatus = "idle" | "error" | "success";

type SmartPortraitDropzoneProps = {
  uploadedUrl?: string;
  uploadedName?: string;
  onFileSelected: (file: File) => Promise<void>;
  onPreview?: (previewUrl: string) => void;
  onRemove?: () => void;
};

export default function SmartPortraitDropzone({
  uploadedUrl,
  uploadedName,
  onFileSelected,
  onPreview,
  onRemove,
}: SmartPortraitDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  const uploadAttemptRef = useRef(0);
  const [status, setStatus] = useState<DropzoneStatus>(uploadedUrl ? "success" : "idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(uploadedUrl ?? null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);

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

    void onFileSelected(file).catch((error: unknown) => {
      if (uploadAttemptRef.current !== uploadAttempt) return;
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Photo upload failed.");
    });
  }

  function openFilePicker() {
    inputRef.current?.click();
  }

  return (
    <div>
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
      <div
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
        className={status === "success"
          ? "w-full"
          : "w-full"}
      >
        {status === "success" && previewUrl ? (
          <div className="flex h-[92px] w-full items-center gap-4 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200">
              <img src={previewUrl} alt="ID Preview" className="aspect-square h-full w-full object-cover" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex min-w-0 items-center justify-between gap-4">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
                  {selectedFile?.name || uploadedName || "photo.png"}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  {onPreview ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onPreview(previewUrl);
                      }}
                      className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                    >
                      Preview
                    </button>
                  ) : null}
                  {onRemove ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (previewObjectUrlRef.current) {
                          URL.revokeObjectURL(previewObjectUrlRef.current);
                          previewObjectUrlRef.current = null;
                        }
                        setPreviewUrl(null);
                        setSelectedFile(null);
                        setStatus("idle");
                        setErrorMessage("");
                        uploadAttemptRef.current += 1;
                        onRemove();
                      }}
                      className="rounded-md border border-red-100 bg-red-50 px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 hover:text-red-700"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={openFilePicker}
                className="w-fit text-xs text-slate-500 underline hover:text-slate-700"
              >
                Select another image to replace
              </button>
            </div>
          </div>
        ) : status === "error" ? (
          <div className="flex h-[92px] w-full items-center gap-4 rounded-xl border-2 border-dashed border-red-400 bg-red-50 p-4">
            <ImagePlus className="h-8 w-8 text-red-500" aria-hidden="true" />
            <div className="flex min-w-0 flex-1 flex-col">
              <button
                type="button"
                onClick={openFilePicker}
                className="w-fit text-sm font-semibold text-slate-800 underline underline-offset-2"
              >
                Choose a different photo
              </button>
              <span id="portrait-upload-error" role="alert" className="truncate text-xs text-red-700">
                {errorMessage}
              </span>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={openFilePicker}
            className={`flex h-[92px] w-full items-center justify-center gap-4 rounded-xl border-2 border-dashed p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
              isDragging ? "border-sky-500 bg-sky-50" : "border-slate-300 bg-slate-50 hover:bg-slate-100"
            }`}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
              <Upload className="h-5 w-5 text-slate-500" aria-hidden="true" />
            </div>
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold text-slate-700">Drop a portrait photo here</span>
              <span className="text-xs text-slate-500">or click to browse</span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}