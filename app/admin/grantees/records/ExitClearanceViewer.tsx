"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  ExternalLink,
  FileCheck2,
  LoaderCircle,
  RotateCcw,
  X,
} from "lucide-react";

type ExitClearance = {
  signedUrl: string;
  fileName: string;
  mimeType: string;
};

const LOAD_ERROR = "Could not load the exit-clearance document. Check your connection and try again.";

export default function ExitClearanceViewer({
  granteeId,
  onClose,
}: {
  granteeId: string;
  onClose: () => void;
}) {
  const [document, setDocument] = useState<ExitClearance | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDocument() {
      setIsLoading(true);
      setHasError(false);
      setDocument(null);
      try {
        const response = await fetch(
          `/api/admin/grantees/${granteeId}/exit-clearance`,
          {
            credentials: "include",
            cache: "no-store",
            signal: controller.signal,
          },
        );
        const payload = await response.json().catch(() => null) as
          | Partial<ExitClearance>
          | null;
        if (
          !response.ok ||
          !payload ||
          typeof payload.signedUrl !== "string"
        ) {
          throw new Error(LOAD_ERROR);
        }
        setDocument({
          signedUrl: payload.signedUrl,
          fileName: typeof payload.fileName === "string" ? payload.fileName : "Exit clearance",
          mimeType: typeof payload.mimeType === "string" ? payload.mimeType : "",
        });
      } catch {
        if (!controller.signal.aborted) setHasError(true);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadDocument();
    return () => controller.abort();
  }, [granteeId, retryCount]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const isPdf =
    document?.mimeType === "application/pdf" ||
    document?.fileName.toLowerCase().endsWith(".pdf");

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-clearance-title"
        className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-emerald-50/60 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <FileCheck2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="exit-clearance-title" className="text-base font-semibold text-slate-900">
                Exit Clearance
              </h2>
              <p className="truncate text-xs text-slate-500">
                Secure, time-limited document preview
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close exit-clearance preview"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <main className="p-3 sm:p-5">
          {isLoading ? (
            <div role="status" className="flex h-[420px] flex-col items-center justify-center gap-4 rounded-xl border border-slate-200 bg-slate-50">
              <LoaderCircle className="h-6 w-6 animate-spin text-emerald-600" aria-hidden="true" />
              <p className="text-sm text-slate-600">Generating secure 60-second preview...</p>
            </div>
          ) : null}
          {!isLoading && hasError ? (
            <div role="alert" className="flex h-[420px] flex-col items-center justify-center rounded-xl border border-rose-200 bg-rose-50/70 px-6 text-center">
              <AlertCircle className="h-7 w-7 text-rose-700" aria-hidden="true" />
              <p className="mt-4 max-w-md text-sm font-medium text-rose-900">{LOAD_ERROR}</p>
              <button
                type="button"
                onClick={() => setRetryCount((count) => count + 1)}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Retry
              </button>
            </div>
          ) : null}
          {!isLoading && document ? (
            <div className="flex h-[65vh] min-h-[420px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-2 sm:p-3">
              {isPdf ? (
                <iframe
                  src={document.signedUrl}
                  title={document.fileName}
                  className="h-full w-full rounded-lg border border-slate-200 bg-white"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={document.signedUrl}
                  alt={document.fileName}
                  className="mx-auto max-h-full max-w-full rounded-lg object-contain"
                />
              )}
            </div>
          ) : null}
        </main>

        <footer className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/95 px-5 py-3 backdrop-blur sm:px-6">
          {document ? (
            <a
              href={document.signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Open in New Tab
            </a>
          ) : <span />}
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
