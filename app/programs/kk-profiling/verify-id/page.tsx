"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useState } from "react";

type SelectedFiles = {
  front?: File | null;
  back?: File | null;
  residency?: File | null;
};

type PreviewUrls = {
  front?: string;
  back?: string;
  residency?: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function KKProfilingVerifyIdPage() {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFiles>({ front: null, back: null, residency: null });
  const [previewUrls, setPreviewUrls] = useState<PreviewUrls>({});
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [residencyStatementConfirmed, setResidencyStatementConfirmed] = useState(false);

  useEffect(() => {
    const urls: PreviewUrls = {};

    if (selectedFiles.front) {
      urls.front = URL.createObjectURL(selectedFiles.front);
    }
    if (selectedFiles.back) {
      urls.back = URL.createObjectURL(selectedFiles.back);
    }
    if (selectedFiles.residency) {
      urls.residency = URL.createObjectURL(selectedFiles.residency);
    }

    setPreviewUrls(urls);
    return () => {
      Object.values(urls).forEach((url) => {
        if (url) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [selectedFiles.front, selectedFiles.back, selectedFiles.residency]);

  function resetFiles() {
    setMessage(null);
    setSuccess(null);
    setSelectedFiles({ front: null, back: null, residency: null });
    setResidencyStatementConfirmed(false);
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
    return "Certificate of Residency";
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

    if (!selectedFiles.front || !selectedFiles.back) {
      setMessage("Please upload both the front and back of your ID.");
      return;
    }
    if (!selectedFiles.residency) {
      setMessage("Please upload your Certificate of Residency.");
      return;
    }
    if (!residencyStatementConfirmed) {
      setMessage("Please confirm that your Certificate of Residency states you have lived in the barangay for at least 8 months.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("documentType", "Valid ID + Certificate of Residency");
      formData.append("frontFile", selectedFiles.front as File);
      formData.append("backFile", selectedFiles.back as File);
      formData.append("residencyFile", selectedFiles.residency as File);
      formData.append("residencyStatementConfirmed", String(residencyStatementConfirmed));

      const response = await fetch("/api/programs/kk-profiling/verify-id", {
        method: "POST",
        body: formData,
      });

      const body = await response.json();
      if (!response.ok) {
        setMessage(body.error || "Unable to upload your documents. Please try again.");
      } else {
        setSuccess("Your documents were uploaded successfully.");
        resetFiles();
      }
    } catch (error) {
      console.error(error);
      setMessage("Upload failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F3F7FB] text-slate-900">
      <main className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.35em] text-teal-600">KK Verification</p>
            <h1 className="text-3xl font-bold text-slate-900">Upload identification for KK verification</h1>
            <p className="text-sm text-slate-600">
                Please upload both the front and back of your valid ID and your Certificate of Residency. Both document sets are required to verify your KK profiling registration.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
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
              </div>

              <div>
                <label className="flex flex-col gap-2 text-sm rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <span className="font-semibold">Certificate of Residency</span>
                  <p className="text-sm text-slate-600">
                    Upload a residency certificate that explicitly states you have lived in the barangay for at least 8 months.
                  </p>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(event) => handleFileChange("residency", event.target.files?.[0] ?? null)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3"
                  />
                  {renderPreview("residency", selectedFiles.residency ?? null)}
                </label>
                <label className="mt-4 flex items-start gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={residencyStatementConfirmed}
                    onChange={(event) => setResidencyStatementConfirmed(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span>
                    I confirm that the uploaded Certificate of Residency states I have lived in the barangay for at least 8 months.
                  </span>
                </label>
              </div>
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
                {submitting ? "Uploading..." : "Upload documents"}
              </button>
              <p className="text-sm text-slate-500">Accepted formats: JPG, PNG, PDF. Maximum file size 10MB.</p>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
