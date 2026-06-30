import React from "react";

export interface UploadedFilePreview {
  id: string;
  name: string;
  size?: number;
  status: "queued" | "uploading" | "done" | "error";
  progress?: number;
  previewUrl?: string;
}

type UploadedFilePreviewListProps = {
  files: UploadedFilePreview[];
  onRemoveFile: (id: string) => void;
};

function formatFileSize(bytes?: number) {
  if (bytes === undefined || bytes === null) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function UploadedFilePreviewList({ files, onRemoveFile }: UploadedFilePreviewListProps) {
  return (
    <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="space-y-2">
        {files.map((file) => (
          <div key={file.id} className="overflow-hidden rounded-lg bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 ring-1 ring-slate-200">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                </svg>
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
                <p className="mt-1 text-xs text-slate-500">{formatFileSize(file.size)}</p>
              </div>

              <button
                type="button"
                onClick={() => onRemoveFile(file.id)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label={`Remove ${file.name}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {file.status === "uploading" ? (
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-teal-500 transition-all duration-200"
                  style={{ width: `${Math.min(100, Math.max(0, file.progress ?? 0))}%` }}
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
