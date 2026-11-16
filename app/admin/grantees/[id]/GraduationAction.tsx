"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileCheck2, GraduationCap, Upload, X } from "lucide-react";
import FloatingFeedback from "@/app/components/FloatingFeedback";

export default function GraduationAction({
  granteeId,
  granteeName,
  exitClearanceUrl,
}: {
  granteeId: string;
  granteeName: string;
  exitClearanceUrl: string | null;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [schoolClearanceVerified, setSchoolClearanceVerified] = useState(false);
  const [skClearanceVerified, setSkClearanceVerified] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function confirmGraduation() {
    if (!schoolClearanceVerified || !skClearanceVerified) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("schoolClearanceVerified", String(schoolClearanceVerified));
      formData.set("skClearanceVerified", String(skClearanceVerified));
      formData.set("remarks", remarks);
      if (file) formData.set("file", file);

      const response = await fetch(`/api/admin/grantees/${granteeId}/graduate`, {
        method: "POST",
        body: formData,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof body.error === "string" ? body.error : "Unable to mark grantee as graduated.");
      }

      setIsOpen(false);
      router.refresh();
    } catch (graduationError) {
      setError(graduationError instanceof Error ? graduationError.message : "Unable to mark grantee as graduated.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setIsOpen(true);
        }}
        className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl bg-cyan-800 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-cyan-900 sm:h-10 sm:gap-2 sm:px-3.5 sm:text-sm"
      >
        <GraduationCap className="h-4 w-4 text-cyan-200" aria-hidden="true" />
        Graduate Scholar
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button
            type="button"
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm"
            aria-label="Close graduation verification"
            onClick={() => {
              if (!isSubmitting) setIsOpen(false);
            }}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="graduation-modal-title"
            className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-2xl sm:p-6"
          >
            <header className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-800">
                  <GraduationCap className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 id="graduation-modal-title" className="text-lg font-bold text-slate-900">
                    Verify Exit Clearance &amp; Graduate Scholar
                  </h2>
                  <p className="mt-2 text-sm leading-5 text-slate-600">
                    Completing exit clearance will mark <strong className="text-slate-900">{granteeName}</strong> as graduated,
                    free up <strong className="text-slate-900">1 active slot</strong> for waitlist review, and transition their portal access back to KK Youth.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
                aria-label="Close"
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>

            <div className="mt-5">
              {exitClearanceUrl ? (
                <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                    <FileCheck2 className="h-5 w-5 shrink-0" aria-hidden="true" />
                    Exit Clearance Uploaded
                  </div>
                  <a
                    href={exitClearanceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-9 items-center justify-center rounded-lg border border-emerald-300 bg-white px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                  >
                    Preview Document
                  </a>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-800">No online clearance has been uploaded</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    Optionally upload a scan below, or verify the physical hard copy at the SK Office.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 space-y-3 rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-900">Required exit clearance checks</h3>
              <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={schoolClearanceVerified}
                  onChange={(event) => setSchoolClearanceVerified(event.target.checked)}
                  disabled={isSubmitting}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-600"
                />
                <span>School Exit Clearance / Certificate of Graduation verified</span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={skClearanceVerified}
                  onChange={(event) => setSkClearanceVerified(event.target.checked)}
                  disabled={isSubmitting}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-600"
                />
                <span>SK Office &amp; financial payout clearance verified (no pending holds)</span>
              </label>
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Both checks are required before graduation can be confirmed.
              </p>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Optional on-site clearance scan
                <span className="mt-1 block text-xs font-normal text-slate-500">PDF, JPG, PNG, or WEBP · Maximum 10MB</span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    setError(null);
                  }}
                  disabled={isSubmitting}
                  className="mt-2 block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
                />
                {file ? <span className="mt-1 block truncate text-xs text-slate-600">{file.name}</span> : null}
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Clearance Notes / Reference No.
                <textarea
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  maxLength={1000}
                  rows={3}
                  disabled={isSubmitting}
                  className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-50"
                  placeholder="Optional"
                />
              </label>
            </div>

            {error ? <p className="mt-4 text-sm text-rose-700" role="alert">{error}</p> : null}

            <footer className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmGraduation()}
                disabled={isSubmitting || !schoolClearanceVerified || !skClearanceVerified}
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-800 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-cyan-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? <Upload className="h-4 w-4 animate-pulse" aria-hidden="true" /> : null}
                {isSubmitting ? "Verifying..." : "Confirm Graduation"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {error && !isOpen ? (
        <FloatingFeedback message={error} type="error" onDismiss={() => setError(null)} />
      ) : null}
    </>
  );
}
