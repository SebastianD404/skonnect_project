"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = {
  slug: string;
  requirements?: string[];
};

export default function ProgramApplyClient({ slug, requirements = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<{ badge?: string; label?: string; summary?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Auto-open when page has ?openApply=1 for smoother post-login flow.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("openApply") === "1") {
        setOpen(true);
        // remove the flag from the URL so it doesn't reopen on refresh
        params.delete("openApply");
        const base = window.location.pathname + (params.toString() ? `?${params.toString()}` : "");
        window.history.replaceState({}, document.title, base + window.location.hash);
      }
    } catch (e) {
      // ignore in environments without window
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoading(true);
    fetch(`/api/programs/${slug}/status`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (!mounted) return;
        setStatus(json);
      })
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));

    return () => {
      mounted = false;
    };
  }, [open, slug]);

  const isOpen = (status?.label ?? "").toLowerCase().includes("open") || (status?.badge ?? "").toLowerCase().includes("open");
  const [uploading, setUploading] = useState(false);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<{
    id: string;
    name: string;
    progress: number;
    status: "queued" | "uploading" | "done" | "error";
    url?: string;
    error?: string;
    previewUrl?: string;
  }[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  // Reset the hidden file input so the same file can be chosen again.
  function resetFileInput() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // Handle files dropped or selected
  function handleFiles(files: File[]) {
    setMessage(null);

    const toAdd = files.map((file, i) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${i}`,
      name: file.name,
      progress: 0,
      status: "queued" as const,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    }));

    setUploadedFiles((prev) => [...prev, ...toAdd]);

    // Reset input immediately so the same file can be selected again later.
    resetFileInput();

    // Start uploads
    (async () => {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const id = toAdd[i].id;
        setUploadedFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status: "uploading" } : f)));
        try {
          const url = await (await uploadWithProgress(file, (p) => {
            setUploadedFiles((prev) => prev.map((f) => (f.id === id ? { ...f, progress: p } : f)));
          })).url;

          setUploadedFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status: "done", progress: 100, url } : f)));
          setUploadedUrls((u) => [...u, url]);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Upload failed";
          setUploadedFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status: "error", error: msg } : f)));
          setMessage({ type: "error", text: msg });
        }
      }
    })();
  }

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => {
      for (const f of uploadedFiles) {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [submission, setSubmission] = useState<{ id: string; urls: string[] } | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const router = useRouter();

  function removeFile(id: string) {
    setUploadedFiles((prev) => {
      const toRemove = prev.find((p) => p.id === id);
      if (toRemove?.previewUrl) URL.revokeObjectURL(toRemove.previewUrl);
      // remove any stored public url for this file
      if (toRemove?.url) {
        setUploadedUrls((prevUrls) => prevUrls.filter((u) => u !== toRemove.url));
      }
      return prev.filter((p) => p.id !== id);
    });
    resetFileInput();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex min-w-[220px] items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(15,23,42,0.16)] transition hover:bg-slate-800"
      >
        Apply for SKEAP →
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative flex h-full min-h-0 w-full max-w-4xl max-h-[80vh] flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">SKEAP application</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-950">Submit your application</h3>
                <p className="mt-1 text-sm text-slate-600">Upload your documents and track your SKEAP application from your account.</p>
              </div>
              <button
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

              <div className="grid flex-1 overflow-hidden gap-6 px-6 py-6 lg:grid-cols-[1.05fr_0.95fr] min-h-0">
              <div className="space-y-6 min-h-0 h-full overflow-y-auto pr-2 min-w-0">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 flex flex-col min-w-0 overflow-hidden">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{!loading && status ? (isOpen ? "Applications are open" : "Applications are closed") : "Checking application status"}</p>
                      <p className="mt-2 text-sm text-slate-600">
                        {loading && "Loading program status…"}
                        {!loading && !status && "Unable to load program status. Try again later."}
                        {!loading && status && status.summary}
                      </p>
                    </div>
                    {!loading && status ? (
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${isOpen ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                        {isOpen ? "Open" : "Closed"}
                      </span>
                    ) : null}
                  </div>

                  {!loading && status && !isOpen ? (
                    <div className="mt-5 space-y-4 text-sm text-slate-700">
                      <div className="rounded-2xl bg-white p-4 shadow-sm break-words">
                        <p className="font-semibold text-slate-900">Not accepting applications yet</p>
                        <p className="mt-2">We will announce the next application window through updates and the chatbot.</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Link href="/announcements" className="rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-slate-800">
                          View announcements
                        </Link>
                        <Link href="/chatbot" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-900 hover:bg-slate-50">
                          Ask for help
                        </Link>
                      </div>
                    </div>
                  ) : null}

                  {!loading && status && isOpen ? (
                    <div className="mt-5 grid gap-3 rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
                      <div>
                        <p className="font-semibold text-slate-900">What to prepare</p>
                        <p className="mt-2">Gather your scanned documents before submitting so you can complete your application in one step.</p>
                      </div>
                      <ul className="grid gap-2 text-sm text-slate-700 break-words">
                        {requirements.map((r, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <span className="mt-1 h-2 w-2 rounded-full bg-slate-900" />
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>

                {status && isOpen ? (
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm font-semibold text-slate-900">Before you submit</p>
                    <ul className="mt-3 space-y-3 text-sm text-slate-600">
                      <li>• Only submit clear legible copies of your documents.</li>
                      <li>• Keep file names simple and easy to recognize.</li>
                      <li>• After submitting, you can track your application status and response.</li>
                    </ul>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-4 h-full min-h-0 min-w-0">
                <div className="flex-1 min-h-0 overflow-y-auto pr-1.5 space-y-4">
                {/* Header Row */}
                <div className="rounded-3xl border border-slate-200 bg-white p-5 flex flex-col gap-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Upload documents</p>
                      <p className="mt-1 text-sm text-slate-600">Drag files here or click to choose the documents for your SKEAP application.</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{uploadedFiles.length} selected</span>
                  </div>

                  {/* Download + helper text */}
                  <div className="flex flex-col gap-2">
                    <a
                      href="/SKEAP%20Application%20Form%20(2).docx"
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Download SKEAP application form"
                      className="inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:from-teal-600 hover:to-emerald-600 transition-transform transform hover:-translate-y-0.5"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="white" />
                        <polyline points="7 10 12 15 17 10" stroke="white" />
                        <line x1="12" y1="15" x2="12" y2="3" stroke="white" />
                      </svg>
                      Download application form
                    </a>
                    <p className="text-xs text-slate-500 max-w-xs">Prefer filling a digital copy? Provide a DOCX alongside the PDF.</p>
                  </div>

                  {/* 1. DROPZONE CONTAINER */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragActive(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setIsDragActive(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragActive(false);
                      const files = Array.from(e.dataTransfer?.files ?? []);
                      if (files.length === 0) return;
                      handleFiles(files);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className={`w-full rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm transition ${isDragActive ? "border-teal-500 bg-teal-50" : "hover:border-slate-300"}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                        <span className="text-lg">+</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">Drag files here</p>
                        <p className="mt-1 text-sm text-slate-500">JPG, PNG, PDF or other document images are accepted.</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                      >
                        Choose files
                      </button>
                      <span className="text-xs text-slate-500">Upload limit: 6 files</span>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.doc,.docx"
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        if (files.length === 0) return;
                        const remaining = Math.max(0, 6 - uploadedFiles.length);
                        if (files.length > remaining) {
                          setMessage({ type: "error", text: `Upload limit is 6 files. You can add ${remaining} more.` });
                          handleFiles(files.slice(0, remaining));
                          return;
                        }
                        handleFiles(files);
                      }}
                    />
                  </div>
                </div>

                {/* 2. UPLOADED FILES LIST (sibling) */}
                {uploadedFiles.length > 0 && (
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm max-h-52 overflow-y-auto pr-1.5">
                    <div className="space-y-2">
                      {uploadedFiles.slice(0, 6).map((file) => (
                        <div key={file.id} className="flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3">
                          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 ring-1 ring-slate-200 overflow-hidden">
                            {file.previewUrl ? <img src={file.previewUrl} alt={file.name} className="h-full w-full object-cover" /> : (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <path d="M14 2v6h6" />
                              </svg>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
                            <p className="text-xs text-slate-500">{file.status === "uploading" ? `Uploading ${file.progress ?? 0}%` : file.status === "done" ? "Ready to submit" : file.status === "error" ? "Upload failed" : "Queued"}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {file.status === "done" ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">done</span> : null}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFile(file.id);
                              }}
                              className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                              aria-label={`Remove ${file.name}`}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {message && (
                  <div className={`mt-2 rounded-3xl px-4 py-3 text-sm ${message.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                    {message.text}
                  </div>
                )}
                {toastVisible && (
                  <div className="pointer-events-none fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-emerald-600/25">
                    Application submitted successfully.
                  </div>
                )}
                </div>

                {/* 3. ACTION BUTTONS WRAPPER */}
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  {submission ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 rounded-3xl bg-emerald-50 p-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Application submitted</p>
                          <p className="mt-1 text-sm text-slate-600">Your documents are on their way to the SK team. You can view the status anytime.</p>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Link href={`/applications/${submission.id}`} className="rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-slate-800">
                          View application
                        </Link>
                        <button
                          type="button"
                          onClick={() => setOpen(false)}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <button
                        onClick={async () => {
                          if (uploadedFiles.filter((f) => f.status === "done").length === 0) {
                            setMessage({ type: "error", text: "Please upload at least one file." });
                            return;
                          }
                          setUploading(true);
                          setMessage(null);
                          try {
                            const doneFiles = uploadedFiles.filter((f) => f.status === "done");
                            const urls = doneFiles.map((f) => f.url).filter(Boolean) as string[];

                            const res = await fetch("/api/inquiries", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                subject: `SKEAP application - ${new Date().toISOString()}`,
                                message: `Applicant uploaded files:\n${urls.join("\n")}`,
                              }),
                            });
                            const body = await res.json();
                            if (!res.ok) throw new Error(body?.error || "Failed to notify SK officials");
                            setSubmission({ id: body.inquiryId, urls });
                            setMessage({ type: "success", text: "Application submitted — SK officials will review your documents." });
                            setToastVisible(true);
                            setUploadedFiles([]);
                            setUploadedUrls([]);

                            setTimeout(() => {
                              setToastVisible(false);
                              router.push(`/applications/${body.inquiryId}`);
                            }, 1200);
                          } catch (err) {
                            setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to send application" });
                          } finally {
                            setUploading(false);
                          }
                        }}
                        disabled={uploading || uploadedFiles.some((f) => f.status === "uploading")}
                        className="w-full rounded-2xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {uploading ? "Sending..." : "Send application"}
                      </button>
                      <button
                        onClick={() => setOpen(false)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Helper: upload using XMLHttpRequest to get progress events
async function uploadWithProgress(file: File, onProgress: (pct: number) => void): Promise<{ url: string }>
{
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    fd.append("file", file);

    xhr.open("POST", "/api/grantee/submissions/upload");

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        const pct = Math.round((ev.loaded / ev.total) * 100);
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText || "{}");
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ url: body.url });
        } else {
          reject(new Error(body?.error || `Upload failed (${xhr.status})`));
        }
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Upload failed"));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new Error("Upload aborted"));

    xhr.send(fd);
  });
}
