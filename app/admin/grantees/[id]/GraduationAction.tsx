"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileCheck2, GraduationCap, Upload, X } from "lucide-react";
import FloatingFeedback from "@/app/components/FloatingFeedback";
import { compressImageForUpload } from "@/lib/image-compression";
import {
  ensureSkeapUploadWithinLimit,
  getSkeapUploadErrorMessage,
} from "@/lib/skeap-upload-client";
import ExitClearanceViewer from "../records/ExitClearanceViewer";

type GraduationHolds = {
  pendingPayoutHold: boolean;
  pendingComplianceCount: number;
};

export default function GraduationAction({
  granteeId,
  granteeName,
  exitClearanceUrl,
  exitClearanceFileName,
  exitClearanceSubmittedAt,
  onlineReview = false,
  initiallyOpen = false,
  hideTrigger = false,
  onClose,
}: {
  granteeId: string;
  granteeName: string;
  exitClearanceUrl: string | null;
  exitClearanceFileName: string | null;
  exitClearanceSubmittedAt: string | null;
  onlineReview?: boolean;
  initiallyOpen?: boolean;
  hideTrigger?: boolean;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [schoolClearanceVerified, setSchoolClearanceVerified] = useState(false);
  const [skClearanceVerified, setSkClearanceVerified] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [systemHolds, setSystemHolds] = useState<GraduationHolds | null>(null);
  const [isLoadingHolds, setIsLoadingHolds] = useState(false);
  const [holdCheckError, setHoldCheckError] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const holdRequestRef = useRef<AbortController | null>(null);

  const loadSystemHolds = useCallback(async (signal?: AbortSignal) => {
    setIsLoadingHolds(true);
    setHoldCheckError(null);
    setSystemHolds(null);
    const requestController = new AbortController();
    const abortRequest = () => requestController.abort();
    signal?.addEventListener("abort", abortRequest, { once: true });
    const timeoutId = window.setTimeout(abortRequest, 15_000);
    try {
      const response = await fetch(`/api/admin/grantees/${granteeId}/graduate`, {
        credentials: "include",
        cache: "no-store",
        signal: requestController.signal,
      });
      const payload = await response.json().catch(() => null) as
        | Partial<GraduationHolds & { error: string }>
        | null;
      if (
        !response.ok ||
        !payload ||
        typeof payload.pendingPayoutHold !== "boolean" ||
        typeof payload.pendingComplianceCount !== "number"
      ) {
        throw new Error(
          payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to verify current graduation holds.",
        );
      }
      setSystemHolds({
        pendingPayoutHold: payload.pendingPayoutHold,
        pendingComplianceCount: payload.pendingComplianceCount,
      });
      return {
        pendingPayoutHold: payload.pendingPayoutHold,
        pendingComplianceCount: payload.pendingComplianceCount,
      };
    } catch (holdError) {
      if (!signal?.aborted) {
        setHoldCheckError(
          requestController.signal.aborted
            ? "Checking current graduation holds timed out. Try again before confirming."
            : holdError instanceof Error
            ? holdError.message
            : "Unable to verify current graduation holds.",
        );
      }
      return null;
    } finally {
      window.clearTimeout(timeoutId);
      signal?.removeEventListener("abort", abortRequest);
      if (!signal?.aborted) setIsLoadingHolds(false);
    }
  }, [granteeId]);

  useEffect(() => () => holdRequestRef.current?.abort(), []);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    holdRequestRef.current = controller;
    const timeoutId = window.setTimeout(() => {
      if (!controller.signal.aborted) void loadSystemHolds(controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
      if (holdRequestRef.current === controller) holdRequestRef.current = null;
    };
  }, [isOpen, loadSystemHolds]);

  function openGraduationModal() {
    setError(null);
    setSchoolClearanceVerified(false);
    setSkClearanceVerified(false);
    setFile(null);
    setRemarks("");
    setIsOpen(true);
  }

  function closeGraduationModal() {
    holdRequestRef.current?.abort();
    setIsOpen(false);
    onClose?.();
  }

  async function returnForReupload() {
    const reason = remarks.trim();
    if (!exitClearanceUrl || !reason) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/grantees/${granteeId}/exit-clearance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remarks: reason }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to return exit clearance for re-upload.");
      }

      router.refresh();
      closeGraduationModal();
    } catch (returnError) {
      setError(returnError instanceof Error ? returnError.message : "Unable to return exit clearance for re-upload.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmGraduation() {
    if (!schoolClearanceVerified || !skClearanceVerified) return;
    if (onlineReview && !exitClearanceUrl) {
      setError("An uploaded Exit Clearance document is required before graduation can be confirmed.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const currentHolds = await loadSystemHolds();
      if (!currentHolds) {
        throw new Error("Unable to verify current graduation holds. Try again before confirming.");
      }
      if (currentHolds.pendingPayoutHold) {
        throw new Error("Financial hold detected: resolve or confirm the unconfirmed payout before graduating.");
      }
      if (currentHolds.pendingComplianceCount > 0) {
        throw new Error("Pending compliance submissions must be resolved before graduating.");
      }

      if (file) ensureSkeapUploadWithinLimit(file);
      const uploadFile = file
        ? await compressImageForUpload(file, { maxWidth: 1600, quality: 0.8 })
        : null;
      if (uploadFile) ensureSkeapUploadWithinLimit(uploadFile);
      const formData = new FormData();
      formData.set("schoolClearanceVerified", String(schoolClearanceVerified));
      formData.set("skClearanceVerified", String(skClearanceVerified));
      formData.set("remarks", remarks);
      if (uploadFile) formData.set("file", uploadFile);

      const response = await fetch(`/api/admin/grantees/${granteeId}/graduate`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const submitError = await getSkeapUploadErrorMessage(response, "Unable to mark grantee as graduated.");
        if (response.status === 400) await loadSystemHolds();
        throw new Error(submitError);
      }

      const result = await response.json().catch(() => null) as { emailSent?: boolean } | null;
      setIsOpen(false);
      setError(
        result?.emailSent === true
          ? null
          : "Graduation was recorded, but the official email notice could not be sent.",
      );
      router.refresh();
      if (result?.emailSent === true) onClose?.();
    } catch (graduationError) {
      setError(graduationError instanceof Error ? graduationError.message : "Unable to mark grantee as graduated.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {!hideTrigger ? (
        <button
          type="button"
          onClick={openGraduationModal}
          className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl bg-cyan-800 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-cyan-900 sm:h-10 sm:gap-2 sm:px-3.5 sm:text-sm"
        >
          <GraduationCap className="h-4 w-4 text-cyan-200" aria-hidden="true" />
          Graduate Scholar
        </button>
      ) : null}

      {isOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button
            type="button"
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm"
            aria-label="Close graduation verification"
            onClick={() => {
              if (!isSubmitting) closeGraduationModal();
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
                onClick={closeGraduationModal}
                disabled={isSubmitting}
                aria-label="Close"
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>

            <div className="mt-5">
              {onlineReview || exitClearanceUrl ? (
                <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-2 text-sm text-emerald-900">
                    <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {exitClearanceFileName ||
                          (exitClearanceUrl
                            ? exitClearanceUrl.split("/").pop() || "Exit Clearance Uploaded"
                            : "Exit Clearance document unavailable")}
                      </p>
                      <p className="mt-1 text-xs text-emerald-800">
                        {exitClearanceSubmittedAt
                          ? `Uploaded ${new Intl.DateTimeFormat("en-PH", {
                              dateStyle: "medium",
                              timeStyle: "short",
                              timeZone: "Asia/Manila",
                            }).format(new Date(exitClearanceSubmittedAt))}`
                          : "Submission timestamp unavailable"}
                      </p>
                      {onlineReview && !exitClearanceUrl ? (
                        <p className="mt-1 text-xs font-medium text-rose-700" role="alert">
                          No uploaded document is attached to this submission.
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPreviewOpen(true)}
                    disabled={!exitClearanceUrl}
                    className="inline-flex min-h-9 items-center justify-center rounded-lg border border-emerald-300 bg-white px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    View Clearance
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-800">
                    No online clearance has been uploaded — verify the physical hard copy or school graduation list at the SK Office.
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    You may optionally attach an on-site scan below.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 space-y-3 rounded-xl border border-slate-200 p-4">
              <div className="space-y-2" aria-live="polite">
                {isLoadingHolds ? (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    Checking current financial and compliance holds…
                  </p>
                ) : null}
                {!isLoadingHolds && holdCheckError ? (
                  <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800" role="alert">
                    {holdCheckError}
                  </p>
                ) : null}
                {!isLoadingHolds && systemHolds?.pendingPayoutHold ? (
                  <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs font-medium leading-5 text-amber-900" role="alert">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Financial Hold Detected: This scholar has an unconfirmed payout. Resolve or confirm payout receipt in Accounting before graduating.</span>
                  </p>
                ) : null}
                {!isLoadingHolds && systemHolds && !systemHolds.pendingPayoutHold ? (
                  <p className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    No pending financial payout holds detected
                  </p>
                ) : null}
                {!isLoadingHolds && systemHolds && systemHolds.pendingComplianceCount > 0 ? (
                  <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs font-medium leading-5 text-amber-900" role="alert">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Compliance Hold Detected: {systemHolds.pendingComplianceCount} pending compliance {systemHolds.pendingComplianceCount === 1 ? "submission remains" : "submissions remain"}. Resolve them before graduating.</span>
                  </p>
                ) : null}
              </div>
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

            <div className={`mt-4 grid gap-4 ${onlineReview ? "grid-cols-1" : "sm:grid-cols-2"}`}>
              {!onlineReview ? (
                <div className="block text-sm font-medium text-slate-700">
                Optional on-site clearance scan
                <span className="mt-1 block text-xs font-normal text-slate-500">PDF, JPG/JFIF, PNG, or WEBP · Maximum 4MB</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.jfif,.png,.webp,application/pdf,image/jpeg,image/jfif,image/png,image/webp"
                  onChange={(event) => {
                    const selected = event.target.files?.[0] ?? null;
                    setError(null);
                    try {
                      if (selected) ensureSkeapUploadWithinLimit(selected);
                      setFile(selected);
                    } catch (fileError) {
                      setFile(null);
                      setError(fileError instanceof Error ? fileError.message : "The selected file is too large.");
                    }
                    event.target.value = "";
                  }}
                  disabled={isSubmitting}
                  className="sr-only"
                />
                <div className="mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
                  {file ? (
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-800" title={file.name}>{file.name}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">{formatFileSize(file.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFile(null)}
                        disabled={isSubmitting}
                        aria-label="Remove selected clearance scan"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white hover:text-rose-700 disabled:opacity-50"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-slate-500">Choose a PDF or image scan to attach.</p>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isSubmitting}
                        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                      >
                        <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                        Choose file
                      </button>
                    </div>
                  )}
                  {file ? (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSubmitting}
                      className="mt-2 text-[11px] font-semibold text-cyan-800 hover:underline disabled:opacity-50"
                    >
                      Choose a different file
                    </button>
                  ) : null}
                </div>
                </div>
              ) : null}
              <label className="block text-sm font-medium text-slate-700">
                Clearance Notes / Reference No.
                <textarea
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  maxLength={1000}
                  rows={3}
                  disabled={isSubmitting}
                  className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-50"
                  placeholder="Optional for confirmation; required when returning for re-upload."
                />
              </label>
            </div>

            {error ? <p className="mt-4 text-sm text-rose-700" role="alert">{error}</p> : null}

            <footer className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={closeGraduationModal}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void returnForReupload()}
                disabled={isSubmitting || !exitClearanceUrl || !remarks.trim()}
                className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Return for Re-upload
              </button>
              <button
                type="button"
                onClick={() => void confirmGraduation()}
                disabled={
                  isSubmitting ||
                  (onlineReview && !exitClearanceUrl) ||
                  isLoadingHolds ||
                  Boolean(holdCheckError) ||
                  !systemHolds ||
                  systemHolds.pendingPayoutHold ||
                  systemHolds.pendingComplianceCount > 0 ||
                  !schoolClearanceVerified ||
                  !skClearanceVerified
                }
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
        <FloatingFeedback
          message={error}
          type="error"
          onDismiss={() => {
            setError(null);
            onClose?.();
          }}
        />
      ) : null}
      {isPreviewOpen ? (
        <ExitClearanceViewer
          granteeId={granteeId}
          onClose={() => setIsPreviewOpen(false)}
        />
      ) : null}
    </>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
