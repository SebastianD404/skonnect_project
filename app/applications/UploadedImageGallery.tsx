"use client";

import { useEffect, useState } from "react";
import { FileText, File } from "lucide-react";

interface UploadedImageGalleryProps {
  imageUrls: string[];
}

export default function UploadedImageGallery({ imageUrls }: UploadedImageGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [mimeTypes, setMimeTypes] = useState<Record<string, string>>({});

  function getFilenameFromUrl(url: string) {
    try {
      const u = new URL(url);
      const parts = u.pathname.split("/");
      const last = parts.pop() || "image";
      const name = decodeURIComponent(last);
      return name.replace(/^\d+[-_.]?/, "");
    } catch (e) {
      const parts = url.split("/");
      const name = decodeURIComponent(parts.pop() || "image");
      return name.replace(/^\d+[-_.]?/, "");
    }
  }

  function isImageUrl(url: string) {
    return /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?|$)/i.test(url);
  }

  function getExtension(url: string) {
    const match = url.match(/\.([a-z0-9]+)(?:[?#]|$)/i);
    return match ? match[1].toLowerCase() : "";
  }

  function formatBytes(bytes: number) {
    if (!bytes || bytes <= 0) return "";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`;
  }

  // Fetch HEAD to determine Content-Length and Content-Type for non-image files
  useEffect(() => {
    let mounted = true;
    async function fetchMeta(url: string) {
      try {
        const resp = await fetch(`/api/download?url=${encodeURIComponent(url)}`, { method: "HEAD" });
        if (!mounted) return;
        const length = resp.headers.get("content-length");
        const type = resp.headers.get("content-type");
        setMimeTypes((s) => ({ ...s, [url]: type || "" }));
        if (length) setSizes((s) => ({ ...s, [url]: formatBytes(Number(length)) }));
      } catch (e) {
        // ignore failures; size remains absent
      }
    }

    imageUrls.forEach((url) => {
      if (!isImageUrl(url) && !sizes[url]) {
        fetchMeta(url);
      }
    });

    return () => {
      mounted = false;
    };
  }, [imageUrls]);

  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 max-h-[56rem] overflow-y-auto pb-4">
        {imageUrls.map((url) => {
          const filename = getFilenameFromUrl(url);
          const showAsImage = isImageUrl(url) && !failed[url];
          return (
            <div key={url} className="relative">
              {showAsImage ? (
                <>
                  <a
                    href={`/api/download?url=${encodeURIComponent(url)}`}
                    download={filename}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-3 top-3 z-20 rounded-full bg-white p-1 shadow-sm transition hover:bg-slate-100"
                    aria-label={`Download ${filename}`}
                  >
                    <svg className="h-4 w-4 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </a>
                  <button
                    type="button"
                    onClick={() => setSelectedImage(url)}
                    className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-50 shadow-sm transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 w-full"
                  >
                    <img
                      src={`/api/download?url=${encodeURIComponent(url)}`}
                      alt={filename}
                      className="h-56 w-full object-cover"
                      onError={() => setFailed((s) => ({ ...s, [url]: true }))}
                    />
                  </button>
                </>
              ) : (
                // Document placeholder card (matches image card dimensions)
                <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-50 shadow-sm h-56 flex items-center justify-center px-4">
                  <a
                    href={`/api/download?url=${encodeURIComponent(url)}`}
                    download={filename}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-3 top-3 z-20 rounded-full bg-white p-1 shadow-sm transition hover:bg-slate-100"
                    aria-label={`Download ${filename}`}
                  >
                    <svg className="h-4 w-4 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </a>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-3">
                        {/* File type icons: PDF, Word, generic document */}
                        {(() => {
                          const ext = getExtension(url);
                          const mt = mimeTypes[url] || "";
                          const isPdf = ext === "pdf" || mt.includes("pdf");
                          const isWord = ext === "doc" || ext === "docx" || mt.includes("word");
                          const iconColor = isPdf ? "text-red-500" : isWord ? "text-blue-600" : "text-slate-400";
                          return (
                            <div className="flex flex-col items-center">
                              {isPdf || isWord ? (
                                <FileText className={`h-10 w-10 ${iconColor}`} />
                              ) : (
                                <File className={`h-10 w-10 ${iconColor}`} />
                              )}
                              {(isPdf || isWord) && (
                                <span className={`mt-2 inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold ${isPdf ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                                  {isPdf ? 'PDF' : 'DOCX'}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                    </div>
                    <p className="text-sm font-medium text-slate-900 truncate max-w-[14rem] mx-auto">{filename}</p>
                      {sizes[url] ? <p className="text-xs text-slate-500 mt-1">{sizes[url]}</p> : null}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedImage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative max-h-full w-full max-w-5xl overflow-hidden rounded-[1.25rem] bg-white p-6 shadow-2xl ring-1 ring-slate-200"
            onClick={(event) => event.stopPropagation()}
          >
            <a
              href={`/api/download?url=${encodeURIComponent(selectedImage!)}`}
              download={getFilenameFromUrl(selectedImage!)}
              className="absolute right-20 top-4 z-30 rounded-full bg-white p-2 text-slate-900 shadow transition hover:bg-slate-100 ring-1 ring-slate-100"
              aria-label="Download image"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </a>
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute right-4 top-4 rounded-full bg-white p-2 text-slate-900 shadow transition hover:bg-slate-100 ring-1 ring-slate-100"
            >
              <span className="sr-only">Close preview</span>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="flex items-center justify-center">
              <img
                src={selectedImage}
                alt="Uploaded document preview"
                className="max-h-[82vh] w-full object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
