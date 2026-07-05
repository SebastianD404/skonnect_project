"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useState } from "react";

type SelectedFiles = {
  front?: File | null;
  back?: File | null;
  single?: File | null;
};

type PreviewUrls = {
  front?: string;
  back?: string;
  single?: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function KKProfilingVerifyIdPage() {
  const [documentType, setDocumentType] = useState("Valid ID");
  const [selectedFiles, setSelectedFiles] = useState<SelectedFiles>({ front: null, back: null });
  const [previewUrls, setPreviewUrls] = useState<PreviewUrls>({});
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const urls: PreviewUrls = {};

    if (selectedFiles.front) {
      urls.front = URL.createObjectURL(selectedFiles.front);
    }
    if (selectedFiles.back) {
      urls.back = URL.createObjectURL(selectedFiles.back);
    }
    if (selectedFiles.single) {
      urls.single = URL.createObjectURL(selectedFiles.single);
    }

    setPreviewUrls(urls);
    return () => {
      Object.values(urls).forEach((url) => {
        if (url) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [selectedFiles.front, selectedFiles.back, selectedFiles.single]);

  function resetFilesForType(type: string) {
    setMessage(null);
    setSuccess(null);

    if (type === "Valid ID") {
      setSelectedFiles({ front: null, back: null });
    } else {
      setSelectedFiles({ single: null });
    }
  }

  function handleDocumentTypeChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextType = event.target.value;
    setDocumentType(nextType);
    resetFilesForType(nextType);
  }

  function handleFileChange(field: keyof SelectedFiles, file: File | null) {
    setSelectedFiles((current) => ({
      ...current,
      [field]: file,
    }));
  }

  function removeFile(field: keyof SelectedFiles) {
    setSelectedFiles((current) => ({
      ...current,
      [field]: null,
    }));
  }

  function fileLabel(field: keyof SelectedFiles) {
    if (field === "front") return "Front of ID";
    if (field === "back") return "Back of ID";
    return "Document file";
  }

  function renderPreview(field: keyof SelectedFiles, file: File | null) {
    if (!file) {
      return null;
    }

    const url = previewUrls[field];
    const isImage = file.type.startsWith("image/");
    const isTooLarge = file.size > 10 * 1024 * 1024;

    return (
      <div className="mt-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
        {isImage && url ? (
          <img
            src={url}
            alt={`${fileLabel(field)} preview`}
            className="h-40 w-full rounded-2xl object-cover"
          />
        ) : (
          <div className="flex h-40 items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-600">
            {file.name}
          </div>
        )}
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold">{fileLabel(field)}</span>
            <button
              type="button"
              onClick={() => removeFile(field)}
              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Remove
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 text-slate-600">
            <div>{formatBytes(file.size)}</div>
            <div className="truncate">{file.type || "Unknown format"}</div>
          </div>
          {isTooLarge ? (
            <p className="rounded-xl bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700">
              File exceeds the 10MB limit. Please select a smaller file.
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setSuccess(null);

    if (documentType === "Valid ID") {
      if (!selectedFiles.front || !selectedFiles.back) {
        setMessage("Please upload both the front and back of your ID.");
        return;
      }
    } else if (!selectedFiles.single) {
      setMessage("Please choose a file to upload.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("documentType", documentType);

      if (documentType === "Valid ID") {
        formData.append("frontFile", selectedFiles.front as File);
        formData.append("backFile", selectedFiles.back as File);
      } else {
        formData.append("file", selectedFiles.single as File);
      }

      const response = await fetch("/api/programs/kk-profiling/verify-id", {
        method: "POST",
        body: formData,
      });

      const body = await response.json();
      if (!response.ok) {
        setMessage(body.error || "Unable to upload your documents. Please try again.");
      } else {
        setSuccess(
          documentType === "Valid ID"
            ? "Your ID front and back images were uploaded successfully."
            : `Upload for ${body.type} received successfully.`
        );
        resetFilesForType(documentType);
      }
    } catch (error) {
      console.error(error);
      setMessage("Upload failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const validIdMode = documentType === "Valid ID";
  const requiresSingleFile = !validIdMode;

  return (
    <div className="min-h-screen bg-[#F3F7FB] text-slate-900">
      <main className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.35em] text-teal-600">KK Verification</p>
            <h1 className="text-3xl font-bold text-slate-900">Upload identification for KK verification</h1>
            <p className="text-sm text-slate-600">
              Submit your valid ID or birth certificate so Barangay Pico staff can verify your KK profiling registration. You can also monitor your status on the KK Profiling status page.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-semibold">Document type</span>
                <select
                  value={documentType}
                  onChange={handleDocumentTypeChange}
                  className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3"
                >
                  <option>Valid ID</option>
                  <option>Birth Certificate</option>
                  <option>Other supporting document</option>
                </select>
              </label>

              {requiresSingleFile ? (
                <label className="flex flex-col gap-2 text-sm">
                  <span className="font-semibold">Select file</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(event) => handleFileChange("single", event.target.files?.[0] ?? null)}
                    className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3"
                  />
                </label>
              ) : (
                <div className="sm:col-span-2 grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <span className="font-semibold">Front of ID</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => handleFileChange("front", event.target.files?.[0] ?? null)}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-3"
                    />
                    {renderPreview("front", selectedFiles.front ?? null)}
                  </label>

                  <label className="flex flex-col gap-2 text-sm rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <span className="font-semibold">Back of ID</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => handleFileChange("back", event.target.files?.[0] ?? null)}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-3"
                    />
                    {renderPreview("back", selectedFiles.back ?? null)}
                  </label>
                </div>
              )}
            </div>

            {requiresSingleFile && selectedFiles.single ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                {renderPreview("single", selectedFiles.single)}
              </div>
            ) : null}

            {message ? (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{message}</div>
            ) : null}
            {success ? (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {submitting ? "Uploading..." : validIdMode ? "Upload front and back" : "Upload document"}
              </button>
              <p className="text-sm text-slate-500">Accepted formats: JPG, PNG, PDF. Maximum file size 10MB.</p>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
