"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Clock3, FileCheck2, Upload, X } from "lucide-react";

export default function ExitClearanceSubmission({
  initialStatus,
  initialUrl,
  isFinalStep = false,
}: {
  initialStatus: "NONE" | "SUBMITTED" | "CLEARED";
  initialUrl?: string | null;
  isFinalStep?: boolean;
}) {
  const router = useRouter();
  const [isSubmitted, setIsSubmitted] = useState(initialStatus === "SUBMITTED");
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
      const formData = new FormData();
      formData.set("file", file);
      formData.set("note", note);
      const response = await fetch("/api/grantee/exit-clearance", {
        method: "POST",
        body: formData,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof body.error === "string" ? body.error : "Unable to submit exit clearance.");
      }

      setIsSubmitted(true);
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
    return (
      <section className="relative overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-white via-emerald-50/60 to-amber-50/50 p-6 shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-emerald-200/40 blur-3xl" aria-hidden="true" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-800">
            <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
            Final Step · Exit Clearance
          </span>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">
            Submit Your Exit Clearance
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Upload a clear scan of your School Exit Clearance, Certificate of Graduation, or Diploma (or submit the physical copy at the Barangay Pico SK Office) for final SK Council verification.
          </p>

          {(isSubmitted || initialStatus === "CLEARED") && !isReplaceOpen ? (
            <div className={`mt-6 flex items-start gap-3 rounded-2xl border p-4 ${
              initialStatus === "CLEARED"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`} role="status">
              {initialStatus === "CLEARED"
                ? <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                : <Clock3 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />}
              <div>
                <p className="text-sm font-semibold">
                  {initialStatus === "CLEARED" ? "Exit Clearance Verified" : "Exit Clearance Under Review"}
                </p>
                <p className="mt-1 text-xs leading-5 opacity-80">
                  {initialStatus === "CLEARED"
                    ? "The SK Council has verified your clearance. Your graduation will be confirmed by an administrator."
                    : "Your clearance is with the SK Council for final verification."}
                </p>
                {initialStatus !== "CLEARED" && initialUrl ? (
                  <a
                    href={initialUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex text-xs font-semibold text-emerald-800 underline underline-offset-2"
                  >
                    View submitted clearance
                  </a>
                ) : null}
                {initialStatus !== "CLEARED" ? (
                  <button
                    type="button"
                    onClick={openReplaceForm}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 transition hover:bg-amber-50"
                  >
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    Replace file
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <form onSubmit={submitClearance} className="mt-6 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-300 bg-white/80 px-5 py-5 text-center transition-colors hover:border-emerald-500 hover:bg-white">
                <Upload className="h-6 w-6 text-emerald-700" aria-hidden="true" />
                <span className="mt-2 max-w-full truncate text-sm font-semibold text-slate-800">
                  {file ? file.name : isSubmitted ? "Choose a replacement clearance document" : "Choose your clearance document"}
                </span>
                <span className="mt-1 text-xs text-slate-500">PDF, JPG/JFIF, PNG, WEBP · Max 10MB</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.jfif,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
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
                      className="text-xs font-semibold text-emerald-800 underline underline-offset-2 disabled:opacity-50"
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
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
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
          <p className="mt-4 text-xs text-slate-500">
            You may also present the physical document at the Barangay Pico SK Office.
          </p>
        </div>
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
                <span className="mt-1 block text-xs text-slate-500">PDF, JPG, PNG, or WEBP · Maximum 10MB</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
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
