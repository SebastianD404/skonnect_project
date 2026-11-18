"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Clock3, FileCheck2, GraduationCap, Upload, X } from "lucide-react";
import { compressImageForUpload, ensureSkeapUploadWithinLimit, getSkeapUploadErrorMessage } from "@/lib/skeap-upload-client";

export default function ExitClearanceSubmission({
  initialStatus,
  initialUrl,
  initialFileName,
  initialUploadedAt,
  isGraduated = false,
  isFinalStep = false,
}: {
  initialStatus: "NONE" | "SUBMITTED" | "CLEARED";
  initialUrl?: string | null;
  initialFileName?: string | null;
  initialUploadedAt?: string | null;
  isGraduated?: boolean;
  isFinalStep?: boolean;
}) {
  const router = useRouter();
  const [isSubmitted, setIsSubmitted] = useState(
    initialStatus === "SUBMITTED" || Boolean(initialUrl && initialStatus !== "CLEARED")
  );
  const [currentUrl, setCurrentUrl] = useState(initialUrl ?? null);
  const [currentFileName, setCurrentFileName] = useState(initialFileName ?? null);
  const [currentUploadedAt, setCurrentUploadedAt] = useState(initialUploadedAt ?? null);
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReplaceOpen, setIsReplaceOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = "";
    setFile(selectedFile);
    setError(null);
  }

  function openReplaceForm() {
    setFile(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setIsReplaceOpen(true);
  }

  function openFilePicker() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    fileInputRef.current?.click();
  }

  function removeSelectedFile() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    setFile(null);
    setError(null);
  }

  function cancelReplacement() {
    removeSelectedFile();
    setNote("");
    setIsReplaceOpen(false);
  }

  function closeModal() {
    if (isSubmitting) return;
    setIsOpen(false);
    removeSelectedFile();
    setNote("");
  }

  async function submitClearance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Choose your School Exit Clearance, Certificate of Graduation, or Diploma.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const uploadFile = await compressImageForUpload(file);
      ensureSkeapUploadWithinLimit(uploadFile);
      const formData = new FormData();
      formData.set("file", uploadFile);
      formData.set("note", note);
      const response = await fetch("/api/grantee/exit-clearance", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error(
          await getSkeapUploadErrorMessage(response, "Unable to submit exit clearance. Please try again.")
        );
      }

      const result = await response.json() as {
        exitClearanceUrl?: string;
        exitClearanceFileName?: string;
        exitClearanceSubmittedAt?: string;
      };
      setIsSubmitted(true);
      setCurrentUrl(result.exitClearanceUrl ?? currentUrl);
      setCurrentFileName(result.exitClearanceFileName ?? uploadFile.name);
      setCurrentUploadedAt(result.exitClearanceSubmittedAt ?? new Date().toISOString());
      setIsOpen(false);
      setIsReplaceOpen(false);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setNote("");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit exit clearance.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isFinalStep) {
    const isVerified = initialStatus === "CLEARED" || isGraduated;
    const statusClassName = isVerified
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : isSubmitted
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-slate-200 bg-slate-100 text-slate-600";
    return (
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-[#0d5c75]">
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Graduation &amp; Exit Clearance
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
                Proof of Graduation / School Exit Clearance
              </h2>
            </div>
          </div>
          <span className={`inline-flex w-fit shrink-0 items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusClassName}`}>
            {isVerified ? "Verified & Graduated" : isSubmitted ? "Uploaded · Pending SK Verification" : "Not Submitted"}
          </span>
        </div>

        <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
          Upload a clear scan of your Certificate of Graduation, Diploma, Official Transcript, or Registrar Exit Clearance.
          <span className="mt-1 block text-xs text-slate-500">Supports PDF, JPG/JFIF, PNG, and WebP (Max 4MB)</span>
        </p>

        {(isSubmitted || isVerified) && !isReplaceOpen ? (
            <div className="mt-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                {isVerified
                  ? <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                  : <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {currentFileName || "Exit clearance document"}
                  </p>
                  {currentUploadedAt ? (
                    <time className="mt-1 block text-xs text-slate-500" dateTime={currentUploadedAt}>
                      Uploaded {new Intl.DateTimeFormat("en-PH", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Manila",
                      }).format(new Date(currentUploadedAt))}
                    </time>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {currentUrl ? (
                  <a
                    href={currentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-[#0d5c75] hover:underline"
                  >
                    View File
                  </a>
                ) : null}
                {!isVerified ? (
                  <button
                    type="button"
                    onClick={openReplaceForm}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    Replace File
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <form onSubmit={submitClearance} className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-5 text-center transition-colors hover:border-teal-600 hover:bg-teal-50/40">
                <Upload className="h-6 w-6 text-[#0d5c75]" aria-hidden="true" />
                <span className="mt-2 max-w-full truncate text-sm font-semibold text-slate-800">
                  {file ? file.name : isSubmitted ? "Choose a replacement clearance document" : "Choose your clearance document"}
                </span>
                <span className="mt-1 text-xs text-slate-500">PDF, JPG/JFIF, PNG, and WebP · Max 4MB</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.jfif,.png,.webp,application/pdf,image/jpeg,image/png,image/jfif,image/webp"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>
              {file ? (
                <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
                  <span className="min-w-0 truncate text-xs text-slate-600">Selected: {file.name}</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={openFilePicker}
                      disabled={isSubmitting}
                      className="text-xs font-semibold text-[#0d5c75] underline underline-offset-2 disabled:opacity-50"
                    >
                      Replace file
                    </button>
                    <button
                      type="button"
                      onClick={removeSelectedFile}
                      disabled={isSubmitting}
                      className="text-xs font-semibold text-slate-600 underline underline-offset-2 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="space-y-3">
                <label className="block text-xs font-medium text-slate-700">
                  Optional note
                  <textarea
                    value={note}
                    onChange={(event) => {
                      setNote(event.target.value);
                      setError(null);
                    }}
                    maxLength={1000}
                    rows={2}
                    placeholder="Add context or a reference number"
                    className="mt-1 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
                <button
                  type="submit"
                  disabled={isSubmitting || !file}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0d5c75] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#09495e] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FileCheck2 className="h-4 w-4" aria-hidden="true" />
                  {isSubmitting ? "Submitting…" : isSubmitted ? "Submit Replacement" : "Submit Exit Clearance"}
                </button>
                {isSubmitted ? (
                  <button
                    type="button"
                    onClick={cancelReplacement}
                    disabled={isSubmitting}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel replacement
                  </button>
                ) : null}
              </div>
              {error ? <p className="text-sm text-rose-700 sm:col-span-2" role="alert">{error}</p> : null}
            </form>
          )}
          <p className="mt-4 text-xs leading-5 text-slate-500">
            Please also present the physical copy at <strong className="font-semibold text-slate-700">Barangay Pico Hall</strong> for final exit clearance sign-off.
          </p>
      </section>
    );
  }

  return (
    <>
      {isSubmitted ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800">
            <Clock3 className="h-4 w-4" aria-hidden="true" />
            Exit Clearance Under Review
          </span>
          {initialStatus !== "CLEARED" ? (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setIsOpen(true);
              }}
              className="text-sm font-semibold text-slate-700 underline underline-offset-2 hover:text-slate-950"
            >
              Replace file
            </button>
          ) : null}
        </div>
      ) : initialStatus !== "CLEARED" ? (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setIsOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
        >
          <FileCheck2 className="h-4 w-4" aria-hidden="true" />
          Submit Exit Clearance (Graduating)
        </button>
      ) : null}

      {isOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close exit clearance form"
            onClick={closeModal}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="exit-clearance-title"
            className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="exit-clearance-title" className="text-lg font-bold text-slate-900">
                  {isSubmitted ? "Replace Exit Clearance" : "Submit Exit Clearance"}
                </h2>
                <p className="mt-1 text-sm leading-5 text-slate-600">
                  {isSubmitted
                    ? "Upload a replacement document. The updated file will be sent to SK for verification."
                    : "Upload your School Exit Clearance, Certificate of Graduation, or Diploma for SK review."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={isSubmitting}
                aria-label="Close"
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={submitClearance} className="mt-5 space-y-4">
              <label className="block rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                <Upload className="mx-auto h-6 w-6 text-slate-500" aria-hidden="true" />
                <span className="mt-2 block text-sm font-semibold text-slate-800">
                  {file ? file.name : "Choose clearance document"}
                </span>
                <span className="mt-1 block text-xs text-slate-500">PDF, JPG/JFIF, PNG, or WEBP · Maximum 4MB</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.jfif,.png,.webp,application/pdf,image/jpeg,image/jfif,image/png,image/webp"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>
              {file ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-xs text-slate-600">Selected: {file.name}</span>
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={openFilePicker}
                      disabled={isSubmitting}
                      className="text-xs font-semibold text-cyan-800 underline underline-offset-2 disabled:opacity-50"
                    >
                      Replace file
                    </button>
                    <button
                      type="button"
                      onClick={removeSelectedFile}
                      disabled={isSubmitting}
                      className="text-xs font-semibold text-slate-600 underline underline-offset-2 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : null}

              <label className="block text-sm font-medium text-slate-700">
                Optional note
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="Add context or a reference number"
                  className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                />
              </label>

              {error ? <p className="text-sm text-rose-700" role="alert">{error}</p> : null}

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !file}
                  className="rounded-xl bg-cyan-800 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? "Submitting…" : isSubmitted ? "Submit Replacement" : "Submit for Review"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
