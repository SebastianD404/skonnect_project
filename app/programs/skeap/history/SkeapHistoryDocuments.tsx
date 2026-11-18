"use client";

import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Eye,
  FileText,
  Minus,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";

type HistoricalDocument = {
  label: string;
  url: string;
  name?: string;
};

function getFilename(document: HistoricalDocument) {
  if (document.name?.trim()) return document.name.trim();
  const filename = document.url.split(/[?#]/)[0]?.split("/").pop();
  return filename ? filename.replace(/%20/g, " ") : "Historical document";
}

function getExtension(filename: string, url: string) {
  const urlFilename = url.split(/[?#]/)[0]?.split("/").pop() || "";
  const source = filename.includes(".") ? filename : urlFilename || filename;
  const extension = source.split(".").pop()?.toUpperCase();
  return extension && extension !== source.toUpperCase() ? extension : "FILE";
}

export default function SkeapHistoryDocuments({
  documents,
}: {
  documents: HistoricalDocument[];
}) {
  const [selectedDocument, setSelectedDocument] = useState<HistoricalDocument | null>(null);
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    if (!selectedDocument) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedDocument(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedDocument]);

  const openPreview = (document: HistoricalDocument) => {
    setZoom(100);
    setSelectedDocument(document);
  };

  return (
    <>
      {documents.length ? (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {documents.map((document, index) => {
            const filename = getFilename(document);
            const extension = getExtension(filename, document.url);
            const isImage = ["JPG", "JPEG", "PNG", "WEBP", "GIF", "AVIF"].includes(extension);

            return (
              <article
                key={document.label}
                className="rounded-xl border border-slate-200/90 bg-white p-3.5 transition-all hover:border-sky-300/80 hover:shadow-sm"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => openPreview(document)}
                    aria-label={`Preview ${document.label}`}
                    className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                  >
                    {isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={document.url}
                        alt=""
                        className="h-full w-full object-cover transition-transform group-hover:scale-110"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center">
                        <FileText className="h-5 w-5 text-slate-500" aria-hidden="true" />
                      </span>
                    )}
                    <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white ring-2 ring-white">
                      {index + 1}
                    </span>
                    <span className="absolute inset-0 flex items-center justify-center bg-slate-950/35 text-white opacity-0 transition-opacity group-hover:opacity-100">
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </button>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-slate-900">{document.label}</h3>
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                      <span className="max-w-48 truncate text-xs text-slate-500">{filename}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-wider text-slate-600">
                        {extension}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => openPreview(document)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-800 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    Preview
                  </button>
                  <a
                    href={document.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    Open <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          No historical enrollment or grade documents are available for this application.
        </p>
      )}

      {selectedDocument ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedDocument(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="historical-document-preview-title"
            className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <h2 id="historical-document-preview-title" className="truncate text-sm font-semibold text-slate-900">
                  {selectedDocument.label}
                </h2>
                <p className="mt-0.5 truncate text-xs text-slate-500">{getFilename(selectedDocument)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setZoom((current) => Math.max(50, current - 25))}
                  aria-label="Zoom out"
                  className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </button>
                <span className="min-w-12 text-center text-xs font-semibold text-slate-600">{zoom}%</span>
                <button
                  type="button"
                  onClick={() => setZoom((current) => Math.min(200, current + 25))}
                  aria-label="Zoom in"
                  className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(100)}
                  aria-label="Reset zoom"
                  className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDocument(null)}
                  aria-label="Close preview"
                  className="ml-1 rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </header>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-100 p-3 sm:p-6">
              {["JPG", "JPEG", "PNG", "WEBP", "GIF", "AVIF"].includes(
                getExtension(getFilename(selectedDocument), selectedDocument.url),
              ) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedDocument.url}
                  alt={selectedDocument.label}
                  className="max-h-full max-w-full object-contain transition-transform"
                  style={{ transform: `scale(${zoom / 100})` }}
                />
              ) : (
                <iframe
                  title={`${selectedDocument.label} document preview`}
                  src={`${selectedDocument.url}#toolbar=1&zoom=${zoom}`}
                  className="h-[75vh] w-full rounded-lg border border-slate-200 bg-white"
                />
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
