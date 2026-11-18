"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Eye,
  FileImage,
  FileText,
  GraduationCap,
  Info,
  LoaderCircle,
  Upload,
  X,
} from "lucide-react";
import { compressImageForUpload } from "@/lib/image-compression";
import {
  ensureSkeapUploadWithinLimit,
  getSkeapUploadErrorMessage,
} from "@/lib/skeap-upload-client";

type ExitClearanceStatus = "NONE" | "SUBMITTED" | "RETURNED" | "CLEARED";
type SignedExitClearance = {
  url: string;
  fileName: string;
  mimeType: string;
};
type LocalPreview = {
  file: File;
  url: string;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isImageFile(file: File) {
  return file.type.startsWith("image/") || /\.(jpe?g|jfif|png|webp)$/i.test(file.name);
}

function isPdfFile(file: Pick<File, "name" | "type">) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

export default function ExitClearanceSubmission({
  initialStatus,
  initialUrl,
  initialRemarks,
  initialFileName,
  initialSubmittedAt,
  isDueForGraduation,
}: {
  initialStatus: ExitClearanceStatus;
  initialUrl: string | null;
  initialRemarks: string | null;
  initialFileName: string | null;
  initialSubmittedAt: string | null;
  isDueForGraduation: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const signedRequestRef = useRef<AbortController | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState(initialStatus);
  const [documentUrl, setDocumentUrl] = useState(initialUrl);
  const [graduationRemarks, setGraduationRemarks] = useState(initialRemarks);
  const [fileName, setFileName] = useState(initialFileName);
  const [submittedAt, setSubmittedAt] = useState(initialSubmittedAt);
  const [signedDocument, setSignedDocument] = useState<SignedExitClearance | null>(null);
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<LocalPreview | null>(null);
  const [isReplacing, setIsReplacing] = useState(initialStatus === "NONE" && !initialUrl);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"selected" | "saved" | null>(null);

  const hasSubmission = status === "SUBMITTED" || status === "RETURNED" || Boolean(documentUrl);
  const isCleared = status === "CLEARED";
  const canReplace = hasSubmission && !isCleared;
  const isDueActionRequired =
    isDueForGraduation && !hasSubmission && !isCleared;
  const selectedPreviewUrl = localPreview?.file === selectedFile ? localPreview.url : null;

  useEffect(() => {
    if (!selectedFile) return;
    const url = URL.createObjectURL(selectedFile);
    // Object URLs are owned by this effect and revoked when the selection changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalPreview({ file: selectedFile, url });
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  useEffect(() => () => signedRequestRef.current?.abort(), []);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) {
        signedRequestRef.current?.abort();
        setIsOpen(false);
        setIsLoadingDocument(false);
        setPreviewMode(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting]);

  function closeModal() {
    signedRequestRef.current?.abort();
    setIsOpen(false);
    setIsLoadingDocument(false);
    setPreviewMode(null);
  }

  function openModal() {
    setError(null);
    setDocumentError(null);
    setSignedDocument(null);
    setPreviewMode(null);
    setIsOpen(true);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = "";
    setError(null);
    if (!selected) return;

    const validFileType = /\.(pdf|jpe?g|jfif|png|webp)$/i.test(selected.name) ||
      /^(application\/pdf|image\/(jpeg|jfif|png|webp))$/i.test(selected.type);
    if (!validFileType) {
      setSelectedFile(null);
      setError("Upload a PDF, JPG/JFIF, PNG, or WEBP file.");
      return;
    }
    try {
      if (!isImageFile(selected)) ensureSkeapUploadWithinLimit(selected);
      setSelectedFile(selected);
    } catch (fileError) {
      setSelectedFile(null);
      setError(fileError instanceof Error ? fileError.message : "The selected file is too large.");
    }
  }

  async function viewSavedFile() {
    if (!documentUrl) return;
    signedRequestRef.current?.abort();
    const controller = new AbortController();
    signedRequestRef.current = controller;
    setDocumentError(null);
    setSignedDocument(null);
    setIsLoadingDocument(true);
    try {
      const response = await fetch("/api/grantee/exit-clearance", {
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null) as
        | Partial<SignedExitClearance & { error: string }>
        | null;
      if (!response.ok || !payload || typeof payload.url !== "string") {
        throw new Error(
          payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to open the uploaded exit clearance.",
        );
      }
      const savedDocument = {
        url: payload.url,
        fileName: typeof payload.fileName === "string" ? payload.fileName : "Exit Clearance",
        mimeType: typeof payload.mimeType === "string" ? payload.mimeType : "",
      };
      setSignedDocument(savedDocument);
      setPreviewMode("saved");
    } catch (loadError) {
      if (!controller.signal.aborted) {
        setDocumentError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to open the uploaded exit clearance.",
        );
      }
    } finally {
      if (!controller.signal.aborted) setIsLoadingDocument(false);
    }
  }

  async function submitClearance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setError("Choose your School Exit Clearance or Certificate of Graduation.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const extension = selectedFile.name.split(".").pop()?.toLowerCase();
      const imageType = extension === "png"
        ? "image/png"
        : extension === "webp"
          ? "image/webp"
          : ["jpg", "jpeg", "jfif"].includes(extension ?? "")
            ? "image/jpeg"
            : null;
      const uploadSource = !selectedFile.type && (imageType || extension === "pdf")
        ? new File([selectedFile], selectedFile.name, {
            type: imageType ?? "application/pdf",
            lastModified: selectedFile.lastModified,
          })
        : selectedFile;
      const uploadFile = isImageFile(selectedFile)
        ? await compressImageForUpload(uploadSource, { maxWidth: 1600, quality: 0.8 })
        : uploadSource;
      ensureSkeapUploadWithinLimit(uploadFile);

      const formData = new FormData();
      formData.set("file", uploadFile);
      const response = await fetch("/api/grantee/exit-clearance", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error(
          await getSkeapUploadErrorMessage(response, "Unable to submit exit clearance. Please try again."),
        );
      }

      const result = await response.json() as {
        exitClearanceStatus?: ExitClearanceStatus;
        exitClearanceUrl?: string;
        exitClearanceFileName?: string;
        exitClearanceSubmittedAt?: string;
      };
      setStatus(result.exitClearanceStatus ?? "SUBMITTED");
      setDocumentUrl(result.exitClearanceUrl ?? null);
      setGraduationRemarks(null);
      setFileName(result.exitClearanceFileName ?? uploadFile.name);
      setSubmittedAt(result.exitClearanceSubmittedAt ?? new Date().toISOString());
      setSignedDocument(null);
      setSelectedFile(null);
      setIsReplacing(false);
      setPreviewMode(null);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit exit clearance.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const statusLabel = isCleared
    ? "Exit Clearance Verified"
    : status === "RETURNED"
      ? "Returned · Action Required"
      : hasSubmission
      ? "Submitted · Pending SK Verification"
      : isDueActionRequired
        ? "Final Semester · Action Required"
        : "Ready when graduating";
  const statusClassName = isCleared
    ? "border-teal-200 bg-teal-50 text-teal-800"
    : status === "RETURNED"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : hasSubmission
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : isDueActionRequired
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-slate-200 bg-slate-100 text-slate-600";
  const savedDocumentMimeType =
    signedDocument?.mimeType ||
    (signedDocument?.fileName.toLowerCase().endsWith(".pdf") ? "application/pdf" : "");
  const isPreviewPdf = previewMode === "selected"
    ? selectedFile ? isPdfFile(selectedFile) : false
    : savedDocumentMimeType === "application/pdf";
  const activePreviewUrl = previewMode === "selected"
    ? selectedPreviewUrl ?? undefined
    : signedDocument?.url;
  const activePreviewName = previewMode === "selected"
    ? selectedFile?.name ?? "Selected clearance"
    : signedDocument?.fileName ?? "Uploaded clearance";
  const physicalCopyInstruction = (
    <p className="flex items-start gap-2 text-xs text-slate-500">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      <span>After uploading, please present the original physical copy at the Barangay Pico SK Office for final sign-off.</span>
    </p>
  );
  const shouldShowUploadForm =
    !isCleared && (!hasSubmission || (canReplace && isReplacing && selectedFile !== null));

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="mt-3 flex w-full items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-teal-300 hover:bg-teal-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
      >
        <span className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-800">
            <GraduationCap className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
              Exit Clearance
              <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            </span>
            <span className="mt-1 block text-xs leading-5 text-slate-600">
              {status === "RETURNED"
                ? "Your clearance needs an update. Review the SK Admin note and upload a clearer copy."
                : isDueActionRequired
                ? "You have reached your final semester. Submit your Exit Clearance or Certificate of Graduation to close out your SKEAP grant."
                : "Upload your School Exit Clearance or Certificate of Graduation to complete your SKEAP grant."}
            </span>
            {status === "RETURNED" && graduationRemarks ? (
              <span className="mt-1 block text-xs leading-5 text-rose-700">
                SK Admin note: {graduationRemarks}
              </span>
            ) : null}
          </span>
        </span>
        <span className={`shrink-0 rounded-full border px-3 py-1.5 text-center text-[10px] font-semibold sm:text-xs ${statusClassName}`}>
          {statusLabel}
        </span>
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSubmitting) closeModal();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="exit-clearance-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4">
              <div>
                <h2 id="exit-clearance-title" className="text-lg font-bold text-slate-900">
                  Submit Exit Clearance
                </h2>
                <p className="mt-1 text-sm leading-5 text-slate-600">
                  Upload your School Exit Clearance or Certificate of Graduation.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={isSubmitting}
                aria-label="Close exit clearance form"
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>

            {!isCleared ? (
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.jfif,.png,.webp,application/pdf,image/jpeg,image/jfif,image/png,image/webp"
                onChange={handleFileChange}
                disabled={isSubmitting}
                className="sr-only"
              />
            ) : null}

            {previewMode ? (
              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => setPreviewMode(null)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Back
                </button>
                {isPreviewPdf ? (
                  <iframe
                    src={activePreviewUrl}
                    title={activePreviewName}
                    className="mt-3 h-[65vh] w-full rounded-lg border-0"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activePreviewUrl}
                    alt={activePreviewName}
                    className="mt-3 block w-full max-h-[65vh] object-contain rounded-lg"
                  />
                )}
              </div>
            ) : (
              <>
                {hasSubmission && !selectedFile ? (
                  <div className="mt-5 space-y-4">
                    {status === "RETURNED" ? (
                      <div className="rounded-xl border border-rose-200/80 bg-rose-50/50 px-3.5 py-3">
                        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden="true" />
                          Returned · Action Required
                        </p>
                        {graduationRemarks ? (
                          <p className="mt-1 text-xs leading-relaxed text-rose-900/90">
                            SK Admin note: {graduationRemarks}
                          </p>
                        ) : null}
                      </div>
                    ) : status === "SUBMITTED" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200/80 bg-teal-50/70 px-2.5 py-1 text-xs font-medium text-teal-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-teal-600" aria-hidden="true" />
                        Submitted · Pending SK Verification
                      </span>
                    ) : isCleared ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200/80 bg-teal-50/70 px-2.5 py-1 text-xs font-medium text-teal-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-teal-600" aria-hidden="true" />
                        Exit Clearance Verified
                      </span>
                    ) : null}

                    {documentUrl ? (
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-slate-50/60 p-3.5 transition hover:border-slate-300">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-slate-600 shadow-2xs">
                            {/\.(png|jpe?g|jfif|webp)$/i.test(fileName || documentUrl)
                              ? <FileImage className="h-5 w-5" aria-hidden="true" />
                              : <FileText className="h-5 w-5" aria-hidden="true" />}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900" title={fileName || "Exit Clearance"}>
                              {fileName || "Exit Clearance"}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {submittedAt
                                ? new Intl.DateTimeFormat("en-PH", {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                    timeZone: "Asia/Manila",
                                  }).format(new Date(submittedAt))
                                : "Submission date unavailable"}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void viewSavedFile()}
                            disabled={isLoadingDocument}
                            aria-label="View clearance"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-2xs transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
                          >
                            {isLoadingDocument
                              ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                              : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
                            View
                          </button>
                          {canReplace ? (
                            <button
                              type="button"
                              onClick={() => {
                                setError(null);
                                setIsReplacing(true);
                                fileInputRef.current?.click();
                              }}
                              className={status === "RETURNED"
                                ? "inline-flex items-center gap-1.5 rounded-lg bg-[#0C2D48] px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-[#133E63]"
                                : "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-100"}
                            >
                              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                              Replace
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    {documentError ? (
                      <p className="text-xs text-rose-700" role="alert">{documentError}</p>
                    ) : null}
                    {error ? <p className="text-sm text-rose-700" role="alert">{error}</p> : null}
                    {!isCleared ? physicalCopyInstruction : null}
                  </div>
                ) : null}

                {shouldShowUploadForm ? (
                  <form onSubmit={submitClearance} className="mt-5 space-y-4">
                    {selectedFile ? (
                      <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs">
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setPreviewMode("selected")}
                            disabled={!selectedPreviewUrl || isSubmitting}
                            aria-label={`Preview ${selectedFile.name}`}
                            className="group relative flex h-36 w-full cursor-pointer items-center justify-center bg-slate-50/80 p-3 disabled:cursor-wait"
                          >
                            {isImageFile(selectedFile) ? (
                              selectedPreviewUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={selectedPreviewUrl}
                                  alt={`Preview of ${selectedFile.name}`}
                                  className="max-h-full max-w-full object-contain"
                                />
                              ) : (
                                <span className="text-xs text-slate-500" role="status">
                                  Preparing image preview…
                                </span>
                              )
                            ) : (
                              <span className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wider text-rose-700">
                                <FileText className="h-5 w-5" aria-hidden="true" />
                                PDF document
                              </span>
                            )}
                            <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-full bg-slate-900/75 px-2.5 py-1 text-[11px] font-medium text-white opacity-80 transition group-hover:opacity-100">
                              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                              Click to expand
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFile(null);
                              setError(null);
                              if (canReplace) setIsReplacing(false);
                            }}
                            disabled={isSubmitting}
                            aria-label="Remove file"
                            title="Remove file"
                            className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-500 shadow-xs transition hover:text-rose-600 disabled:opacity-50"
                          >
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-3.5 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900" title={selectedFile.name}>
                              {selectedFile.name}
                            </p>
                            <p className="text-xs text-slate-500">{formatFileSize(selectedFile.size)}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isSubmitting}
                            className="shrink-0 text-xs font-semibold text-teal-700 transition hover:text-teal-800 disabled:opacity-50"
                          >
                            Change
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-5 text-center transition-colors hover:border-teal-600 hover:bg-teal-50/40">
                        <Upload className="h-6 w-6 text-teal-800" aria-hidden="true" />
                        <span className="mt-2 text-sm font-semibold text-slate-800">
                          Choose your clearance document
                        </span>
                        <span className="mt-1 text-xs text-slate-500">PDF, JPG/JFIF, PNG, or WEBP · Max 4MB</span>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isSubmitting}
                          className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-teal-800 shadow-sm ring-1 ring-slate-200 hover:bg-teal-50"
                        >
                          Choose File
                        </button>
                      </div>
                    )}
                    {physicalCopyInstruction}
                    {error ? <p className="text-sm text-rose-700" role="alert">{error}</p> : null}
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSubmitting || !selectedFile}
                        className="inline-flex items-center gap-2 rounded-xl bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSubmitting
                          ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                          : <Upload className="h-4 w-4" aria-hidden="true" />}
                        {isSubmitting
                          ? "Uploading..."
                          : canReplace
                            ? "Resubmit Exit Clearance"
                            : "Submit Exit Clearance"}
                      </button>
                    </div>
                  </form>
                ) : null}
              </>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
