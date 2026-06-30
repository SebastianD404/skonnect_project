"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, FileText, Image, Upload, X } from "lucide-react";

type ReviewAttachment = {
  fileId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  adminRemark: string;
};

type ReviewMessage = {
  id: string;
  role: "admin" | "applicant";
  createdAt: string;
  text: string;
  attachments?: ReviewAttachment[];
};

type ApplicationReviewProps = {
  application: {
    id: string;
    message: string;
    response: string | null;
    isResolved: boolean;
    createdAt: string;
    reviewStatus: string;
    resubmittedAt: string | null;
    lastUpdatedBy: string | null;
    reviewThread: ReviewMessage[];
  };
};

type StagedReplacement = {
  originalUrl: string;
  file: File;
  previewUrl: string;
  status: "pending" | "uploading" | "uploaded" | "error";
  error?: string;
  uploadedUrl?: string;
};

type SubmittedFile = {
  id: string;
  originalUrl: string;
  label: string;
  typeLabel: string;
  isImage: boolean;
  fileName: string;
};

const MAX_FILE_SIZE = 12 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

function extractUrls(text: string) {
  const urlRegex = /https?:\/\/[^\s"'<>]+/g;
  return Array.from(text.match(urlRegex) || []);
}

function getFilenameFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const name = parsed.pathname.split("/").pop() || url;
    return decodeURIComponent(name.replace(/\+/g, " "));
  } catch {
    const parts = url.split("/");
    return decodeURIComponent(parts.pop() || url);
  }
}

function stripDatabasePrefix(filename: string) {
  return filename.replace(/^\d+-/, "");
}

function normalizeDocumentLabel(raw: string) {
  const label = raw.trim();
  const keyword = label.toLowerCase();
  if (keyword.includes("barangay")) return "Barangay Clearance";
  if (keyword.includes("skeap") && keyword.includes("form")) return "SKEAP Form";
  if (keyword.includes("id") && keyword.includes("photo")) return "ID Photo";
  if (keyword.includes("passport")) return "Passport";
  if (keyword.includes("proof") && keyword.includes("address")) return "Proof of Address";
  if (keyword.includes("recommendation")) return "Recommendation Letter";
  return label.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Document";
}

function isImageUrl(url: string) {
  return /\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i.test(url);
}

function getFileTypeLabel(url: string) {
  if (isImageUrl(url)) return "Image";
  if (/\.pdf(\?|$)/i.test(url)) return "PDF";
  if (/\.(docx?|xlsx?|pptx?)(\?|$)/i.test(url)) return "Document";
  return "Document";
}

function isCorrectionNote(text: string) {
  return /correction|required|missing|incorrect|resubmit|return(ed)?/i.test(text);
}

function createFileLabel(url: string, index: number) {
  const filename = getFilenameFromUrl(url);
  return normalizeDocumentLabel(filename) || `Document ${index + 1}`;
}

function getFileActionHint(reviewThread: ReviewMessage[], file: SubmittedFile) {
  const lowerLabel = file.label.toLowerCase();
  return reviewThread.some((message) => {
    if (message.role !== "admin") return false;
    const text = message.text.toLowerCase();
    if (message.attachments?.some((attachment) => {
      return (
        attachment.fileUrl === file.originalUrl ||
        attachment.fileName.toLowerCase() === file.fileName.toLowerCase() ||
        attachment.fileName.toLowerCase().includes(lowerLabel) ||
        lowerLabel.includes(attachment.fileName.toLowerCase())
      );
    })) {
      return true;
    }
    return text.includes(lowerLabel) && isCorrectionNote(text);
  });
}

async function uploadDocument(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/grantee/submissions/upload", {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || "Upload failed");
  }
  const body = await response.json();
  if (!body?.url) {
    throw new Error("Upload did not return a valid URL");
  }
  return body.url as string;
}

export default function ApplicationReviewClient({ application }: ApplicationReviewProps) {
  const router = useRouter();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [stagedReplacements, setStagedReplacements] = useState<StagedReplacement[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const submittedFiles = useMemo<SubmittedFile[]>(() => {
    const urls = extractUrls(application.message);
    return urls.map((url, index) => {
      const label = createFileLabel(url, index);
      return {
        id: `${index}-${url}`,
        originalUrl: url,
        label,
        typeLabel: getFileTypeLabel(url),
        isImage: isImageUrl(url),
        fileName: getFilenameFromUrl(url),
      };
    });
  }, [application.message]);

  const activeCorrections = useMemo(() => {
    return submittedFiles.filter((file) => getFileActionHint(application.reviewThread, file));
  }, [submittedFiles, application.reviewThread]);

  const stagedMap = useMemo(() => {
    return stagedReplacements.reduce<Record<string, StagedReplacement>>((collector, replacement) => {
      collector[replacement.originalUrl] = replacement;
      return collector;
    }, {});
  }, [stagedReplacements]);

  const reviewStatusLabel = application.reviewStatus || "Pending review";
  const hasActionRequired = activeCorrections.length > 0;
  const updateCount = application.reviewThread.length;
  const fileCount = submittedFiles.length;
  const resubmittedAtText = application.resubmittedAt ? new Date(application.resubmittedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "numeric" }) : null;

  const handleReplacementSelected = (originalUrl: string, file: File) => {
    if (!ALLOWED_TYPES.has(file.type)) {
      setError("Only PDF, DOCX, PNG, JPG, and WEBP files are allowed.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("File must be smaller than 12MB.");
      return;
    }

    setError(null);
    const existing = stagedMap[originalUrl];
    if (existing?.previewUrl) URL.revokeObjectURL(existing.previewUrl);

    const previewUrl = URL.createObjectURL(file);
    setStagedReplacements((current) => [
      ...current.filter((replacement) => replacement.originalUrl !== originalUrl),
      { originalUrl, file, previewUrl, status: "pending" },
    ]);
  };

  const handleCancelReplacement = (originalUrl: string) => {
    setStagedReplacements((current) => {
      const next = current.filter((replacement) => replacement.originalUrl !== originalUrl);
      const removed = current.find((replacement) => replacement.originalUrl === originalUrl);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
    setError(null);
  };

  const handleChooseFile = (originalUrl: string) => {
    fileInputRefs.current[originalUrl]?.click();
  };

  const handleResubmit = async () => {
    if (stagedReplacements.length === 0) {
      setError("Select at least one file replacement before resubmitting.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const uploads = await Promise.all(
        stagedReplacements.map(async (replacement) => {
          const uploadedUrl = await uploadDocument(replacement.file);
          return {
            originalUrl: replacement.originalUrl,
            fileUrl: uploadedUrl,
            fileName: replacement.file.name,
            fileType: replacement.file.type || getFileTypeLabel(replacement.file.name),
          };
        })
      );

      const finalUrls = submittedFiles.map((file) => {
        const replacement = uploads.find((upload) => upload.originalUrl === file.originalUrl);
        return replacement?.fileUrl ?? file.originalUrl;
      });

      const body = {
        urls: finalUrls,
        replacements: uploads,
        message: `Applicant resubmitted files:\n${finalUrls.join("\n")}`,
      };

      const response = await fetch(`/api/applications/${application.id}/resubmit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Resubmission failed");
      }

      setSuccess("Your application has been resubmitted for review.");
      setStagedReplacements((current) => {
        current.forEach((replacement) => replacement.previewUrl && URL.revokeObjectURL(replacement.previewUrl));
        return [];
      });
      setTimeout(() => setSuccess(null), 4500);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to resubmit application.");
    } finally {
      setSubmitting(false);
    }
  };

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/applications/${application.id}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: application.id }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Delete failed");
      }

      setSuccess("Your application has been deleted.");
      setTimeout(() => setSuccess(null), 3500);
      // Redirect applicant to the verified landing page (root)
      router.push("/");
      try {
        router.refresh();
      } catch (e) {
        // ignore refresh errors
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete application.");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  const pendingReplacements = stagedReplacements.length;
  const applicationHighlights = hasActionRequired ? "Correction required" : application.reviewStatus;

  return (
    <div className="space-y-6 pb-32">
      <div className="rounded-3xl border border-slate-100 bg-slate-950/5 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <Link href="/programs" className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-950">
              <span className="text-lg">←</span>
              Return to programs
            </Link>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Application review</p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-950">Application status</h1>
              <p className="mt-3 max-w-2xl text-sm text-slate-600">
                Review feedback is shown first so you can resolve corrections immediately.
              </p>
            </div>
          </div>
          <div className="space-y-2 text-right">
            <span className="inline-flex rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-700">
              {applicationHighlights}
            </span>
            <p className="text-sm text-slate-500">
              Submitted on {new Date(application.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
            {resubmittedAtText ? (
              <p className="text-sm text-slate-500">Resubmitted on {resubmittedAtText}</p>
            ) : null}
          </div>
        </div>
      </div>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Reviewer notes</p>
                <p className="mt-2 text-sm text-slate-600">These notes were sent by the SK review team. Fix any documents flagged below.</p>
              </div>
              <span className={`inline-flex items-center justify-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${hasActionRequired ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"}`}>
                {`${updateCount} ${updateCount === 1 ? "update" : "updates"}`}
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {application.reviewThread.length === 0 ? (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                  No reviewer comments have been posted yet.
                </div>
              ) : (
                application.reviewThread.map((message) => {
                  const urls = extractUrls(message.text);
                  const trimmed = urls.reduce((text, url) => text.replace(url, ""), message.text).trim();
                  return (
                    <div key={message.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                            {message.role === "admin" ? "SK review team" : "Applicant"}
                          </p>
                          <p className="text-sm text-slate-700">{new Date(message.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                        </div>
                        {isCorrectionNote(message.text) ? (
                          <span className="inline-flex rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-rose-700">
                            Correction requested
                          </span>
                        ) : null}
                      </div>
                      {trimmed ? <p className="mt-4 text-sm leading-7 text-slate-800 whitespace-pre-wrap">{trimmed}</p> : null}
                      {urls.length > 0 && (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {urls.map((url) => (
                            <a
                              key={url}
                              href={url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <FileText className="h-4 w-4" />
                              <span className="truncate">{getFilenameFromUrl(url)}</span>
                            </a>
                          ))}
                        </div>
                      )}
                      {message.attachments?.length ? (
                        <div className="mt-4 space-y-3">
                          {message.attachments.map((attachment) => (
                            <div key={attachment.fileId} className="rounded-3xl border border-slate-200 bg-white p-4">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-900">{attachment.fileName}</p>
                                  <p className="mt-1 text-xs text-slate-500">{attachment.adminRemark}</p>
                                </div>
                                <a
                                  href={attachment.fileUrl}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                                >
                                  <Download className="h-4 w-4" />
                                  Download
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Application summary</p>
              <div className="mt-4 space-y-4 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-2">
                  <span>Status</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-700">{reviewStatusLabel}</span>
                </div>
                {hasActionRequired ? (
                  <div className="rounded-2xl bg-rose-50 px-3 py-3 text-sm text-rose-700">
                    Fix the flagged files below and resubmit your application.
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">No active corrections are required right now.</p>
                )}
                {application.lastUpdatedBy ? <p className="text-sm text-slate-600">Last updated by {application.lastUpdatedBy}</p> : null}

                  <div className="mt-4 rounded-3xl bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">Ready to resubmit</p>
                    <p className="mt-2 text-sm text-slate-600">
                      {pendingReplacements > 0
                        ? `${pendingReplacements} replacement file${pendingReplacements > 1 ? "s" : ""} staged and ready to send.`
                        : "Choose at least one file replacement to activate resubmission."}
                    </p>
                    <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
                      <button
                        type="button"
                        disabled={pendingReplacements === 0 || submitting}
                        onClick={handleResubmit}
                        className="flex-1 w-full sm:w-auto inline-flex items-center justify-center rounded-3xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {submitting ? "Resubmitting..." : "Resubmit application"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={submitting}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-red-200 bg-white text-red-600 hover:bg-red-50 hover:border-red-300 font-medium text-sm transition-all duration-200 active:scale-[0.98]"
                      >
                        Delete Application
                      </button>
                    </div>
                  </div>
              </div>
            </div>
          </aside>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Submitted files</p>
              <p className="mt-2 text-sm text-slate-600">Replace individual documents inline and resubmit only the files that need correction.</p>
            </div>
            <span className="inline-flex items-center justify-center whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              {`${fileCount} ${fileCount === 1 ? "file" : "files"}`}
            </span>
          </div>

          <div className="mt-6 flex flex-col gap-2.5">
            {submittedFiles.map((file) => {
              const staged = stagedMap[file.originalUrl];
              const correction = getFileActionHint(application.reviewThread, file);
              const previewSrc = staged?.previewUrl ?? file.originalUrl;
              const displayName = stripDatabasePrefix(file.fileName);
              return (
                <div
                  key={file.id}
                  className={`flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3 py-3 transition hover:bg-slate-50 ${correction ? "border-rose-200 bg-rose-50/40" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-50">
                      {file.isImage ? (
                        <img
                          src={previewSrc}
                          alt={displayName}
                          className="h-full w-full object-cover"
                          onError={(event) => {
                            (event.currentTarget as HTMLImageElement).src = "/document-placeholder.svg";
                          }}
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                          <FileText className="h-5 w-5" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="truncate">{file.typeLabel}</span>
                        {correction ? (
                          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-red-600">Correction required</span>
                        ) : null}
                        {staged ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{staged.status === "uploading" ? "Uploading" : "Replacement ready"}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleChooseFile(file.originalUrl)}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Replace
                    </button>
                    <a
                      href={file.originalUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700"
                      aria-label={`Download ${displayName}`}
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </div>

                  <input
                    ref={(element) => {
                      fileInputRefs.current[file.originalUrl] = element;
                    }}
                    type="file"
                    className="hidden"
                    accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(event) => {
                      const selectedFile = event.target.files?.[0];
                      if (selectedFile) {
                        handleReplacementSelected(file.originalUrl, selectedFile);
                      }
                      event.target.value = "";
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{success}</div>
      ) : null}

      {showDeleteConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Delete your application?</h3>
                <p className="mt-2 text-sm text-slate-600">Are you sure you want to delete this application? This will permanently remove your uploaded documents and submission history from the portal. This action cannot be undone.</p>
              </div>
              <button type="button" onClick={() => setShowDeleteConfirm(false)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
                <X />
              </button>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setShowDeleteConfirm(false)} className="rounded-3xl border border-slate-200 px-4 py-2 text-sm font-medium">Nevermind</button>
              <button type="button" onClick={handleDelete} disabled={deleting} className="rounded-3xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {deleting ? "Deleting..." : "Yes, delete application"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
