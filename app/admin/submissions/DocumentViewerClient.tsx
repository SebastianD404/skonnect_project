"use client";

import { useEffect, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";

type PreviewType = "pdf" | "image" | "unsupported";

const IMAGE_CONTENT_TYPES = new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]);
const INLINE_CONTENT_TYPES = new Set(["application/pdf", ...IMAGE_CONTENT_TYPES]);

export default function DocumentViewerClient({
  submissionId,
  kind,
}: {
  submissionId: string;
  kind: "coe" | "grade";
}) {
  const fileUrl = `/api/submissions/${submissionId}/file?kind=${kind}`;
  const [previewType, setPreviewType] = useState<PreviewType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${fileUrl}&metadata=true`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (response.status === 404 && body?.code === "FILE_NOT_FOUND") {
          throw new Error("The uploaded document could not be found in storage. Ask the grantee to re-upload it.");
        }
        if (!response.ok) throw new Error(body.error || "Could not load this document.");
        return body as { contentType: string | null; extension: string };
      })
      .then(({ contentType, extension }) => {
        if (contentType === "application/pdf" || (!contentType && extension === "pdf")) {
          setPreviewType("pdf");
        } else if (
          (contentType && IMAGE_CONTENT_TYPES.has(contentType)) ||
          (!contentType && ["gif", "jpeg", "jpg", "png", "webp"].includes(extension))
        ) {
          setPreviewType("image");
        } else if (contentType && INLINE_CONTENT_TYPES.has(contentType)) {
          setPreviewType("unsupported");
        } else {
          setPreviewType("unsupported");
        }
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : "Could not load this document.");
      });

    return () => controller.abort();
  }, [fileUrl]);

  const title = kind === "coe" ? "Certificate of Enrollment" : "Grade Report";

  return (
    <main className="flex min-h-screen flex-col bg-slate-100">
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Submission document</p>
            <h1 className="truncate text-sm font-bold text-slate-900 sm:text-base">{title}</h1>
          </div>
        </div>
        {!error ? (
          <a
            href={`${fileUrl}&download=true`}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#0a1f33] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#122e48] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download
          </a>
        ) : null}
      </header>

      <section className="flex flex-1 items-center justify-center p-4 sm:p-8">
        <div className="flex h-[calc(100vh-130px)] min-h-[360px] w-full max-w-6xl items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {error ? (
            <p role="alert" className="px-6 text-center text-sm text-rose-700">{error}</p>
          ) : previewType === "pdf" ? (
            <iframe
              src={`${fileUrl}#toolbar=1&view=FitH`}
              title={title}
              className="h-full w-full border-0"
            />
          ) : previewType === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fileUrl}
              alt={title}
              className="h-full w-full bg-slate-50 object-contain"
            />
          ) : previewType === "unsupported" ? (
            <div className="max-w-md px-6 text-center">
              <FileText className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
              <h2 className="mt-4 text-base font-bold text-slate-900">Preview not available</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                This document format can’t be previewed in the browser. Use Download to open it with a compatible app.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-slate-500" role="status">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading document preview...
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
