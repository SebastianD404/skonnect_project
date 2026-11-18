"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  ExternalLink,
  FileText,
  LoaderCircle,
  RotateCcw,
  X,
} from "lucide-react";

type RevocationProof = {
  signedUrl: string;
  fileName: string;
  proofType: string;
  proofHash: string | null;
  mimeType: string | null;
};

type RevocationProofPayload = {
  signedUrl?: unknown;
  fileName?: unknown;
  proofType?: unknown;
  proofHash?: unknown;
  mimeType?: unknown;
};

const LOAD_ERROR =
  "Could not load the supporting proof document. Check your connection and try again.";

export default function RevocationProofViewer({
  granteeId,
  onClose,
}: {
  granteeId: string;
  onClose: () => void;
}) {
  const [proof, setProof] = useState<RevocationProof | null>(null);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProof() {
      setIsLoading(true);
      setError(false);
      setProof(null);

      try {
        const response = await fetch(
          `/api/admin/grantees/${granteeId}/revocation-proof`,
          {
            credentials: "include",
            cache: "no-store",
            signal: controller.signal,
          },
        );
        const payload = (await response.json().catch(() => null)) as
          | RevocationProofPayload
          | null;

        if (
          !response.ok ||
          !payload ||
          typeof payload.signedUrl !== "string"
        ) {
          throw new Error(LOAD_ERROR);
        }

        setProof({
          signedUrl: payload.signedUrl,
          fileName:
            typeof payload.fileName === "string"
              ? payload.fileName
              : "Supporting proof",
          proofType:
            typeof payload.proofType === "string"
              ? payload.proofType
              : "Supporting document",
          proofHash:
            typeof payload.proofHash === "string" ? payload.proofHash : null,
          mimeType:
            typeof payload.mimeType === "string" ? payload.mimeType : null,
        });
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadProof();
    return () => controller.abort();
  }, [granteeId, retryCount]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const isPdf =
    proof?.mimeType === "application/pdf" ||
    proof?.fileName.toLowerCase().endsWith(".pdf");
  const truncatedHash = proof?.proofHash
    ? `${proof.proofHash.slice(0, 12)}…${proof.proofHash.slice(-8)}`
    : "Unavailable";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="revocation-proof-title"
        className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-sky-50/60 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2
                id="revocation-proof-title"
                className="text-base font-semibold text-slate-900"
              >
                Supporting Proof
              </h2>
              <p className="truncate text-xs text-slate-500">
                Secure, time-limited document preview
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close supporting proof preview"
            className="ml-3 rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        {proof && (
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="min-w-0">
              <span className="inline-flex max-w-full items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800">
                <span className="truncate">{proof.proofType}</span>
              </span>
              <p className="mt-1 truncate text-sm font-medium text-slate-800">
                {proof.fileName}
              </p>
            </div>
            <span
              title={proof.proofHash ?? "SHA-256 hash unavailable"}
              className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 font-mono text-[11px] text-emerald-800"
            >
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
              SHA-256 · {truncatedHash}
            </span>
          </div>
        )}

        <main className="p-3 sm:p-5">
          {isLoading && (
            <div
              role="status"
              className="flex h-[420px] flex-col items-center justify-center gap-4 rounded-xl border border-slate-200 bg-slate-50"
            >
              <div className="w-3/4 max-w-xl animate-pulse space-y-3">
                <div className="h-5 rounded bg-slate-200" />
                <div className="h-72 rounded-lg bg-slate-200" />
                <div className="h-4 w-2/3 rounded bg-slate-200" />
              </div>
              <p className="flex items-center gap-2 text-sm text-slate-600">
                <LoaderCircle
                  className="h-4 w-4 animate-spin text-sky-600"
                  aria-hidden="true"
                />
                Generating secure 60-second preview...
              </p>
            </div>
          )}

          {!isLoading && error && (
            <div
              role="alert"
              className="flex h-[420px] flex-col items-center justify-center rounded-xl border border-rose-200 bg-rose-50/70 px-6 text-center"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                <AlertCircle className="h-6 w-6" aria-hidden="true" />
              </span>
              <p className="mt-4 max-w-md text-sm font-medium text-rose-900">
                {LOAD_ERROR}
              </p>
              <button
                type="button"
                onClick={() => setRetryCount((count) => count + 1)}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Retry
              </button>
            </div>
          )}

          {!isLoading && proof && (
            <div className="flex h-[65vh] min-h-[420px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-2 sm:p-3">
              {isPdf ? (
                <iframe
                  src={proof.signedUrl}
                  title={proof.fileName}
                  className="h-full w-full rounded-lg border border-slate-200 bg-white"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={proof.signedUrl}
                  alt={proof.fileName}
                  className="mx-auto max-h-full max-w-full rounded-lg object-contain"
                />
              )}
            </div>
          )}
        </main>

        <footer className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/95 px-5 py-3 backdrop-blur sm:px-6">
          {proof ? (
            <a
              href={proof.signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Open in New Tab
            </a>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Close
          </button>
        </footer>
      </section>
    </div>
  );
}
