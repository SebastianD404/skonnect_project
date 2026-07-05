"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Download, FileText, Upload, X } from "lucide-react";
import SkeapApplicationFormModal from "@/components/SkeapApplicationFormModal";
import { getCoreUploadGroups, getPhotoUploadGroup, CORE_UPLOAD_KEYS, SKEAP_UPLOAD_LABELS } from "@/lib/skeap-upload";

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
    application?: {
      currentCourse?: string;
      yearLevel?: string;
      gwa?: number | null;
      applicantName?: string;
      permanentAddress?: string;
      dateOfBirth?: string;
      placeOfBirth?: string;
      age?: number;
      civilStatus?: string;
      gender?: string;
      fathersName?: string;
      fathersOccupation?: string;
      fathersContact?: string;
      mothersMaidenName?: string;
      mothersOccupation?: string;
      mothersContact?: string;
      contactNumber?: string;
      emailAddress?: string;
      photoFileUrl?: string;
      uploadedFiles?: unknown;
    };
  };
};

type StagedReplacement = {
  slotId: string;
  originalUrl: string;
  file: File;
  previewUrl: string;
  status: "pending" | "uploading" | "uploaded" | "error";
  error?: string;
  uploadedUrl?: string;
};

type SubmittedFile = {
  id: string;
  slotId: string;
  originalUrl: string;
  label: string;
  typeLabel: string;
  isImage: boolean;
  fileName: string;
  isMissing?: boolean;
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

function getCleanFilename(rawName: string) {
  if (!rawName) return "";
  let cleanName = rawName.replace(/^\d{10,14}-/, "");
  cleanName = cleanName.replace(/\s*\(\d+\)\s*/g, " ").trim();
  return cleanName;
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
  if (/\.pdfm?(\?|$)/i.test(url)) return "PDF";
  if (/\.(docx?|xlsx?|pptx?)(\?|$)/i.test(url)) return "Document";
  return "Document";
}

function isCorrectionNote(text: string) {
  return /correction|required|missing|incorrect|resubmit|return(ed)?/i.test(text);
}

type AttachmentPreview = {
  url: string;
  cleanName: string;
  isImage: boolean;
};

function getFileMetadata(url: string) {
  try {
    const decodedUrl = decodeURIComponent(url);
    let fileNameWithTokens = decodedUrl.substring(decodedUrl.lastIndexOf("/") + 1);
    fileNameWithTokens = fileNameWithTokens.split("?")[0].split("#")[0];
    const cleanName = fileNameWithTokens.replace(/^\d+-/, "") || "Attachment File";
    const isImage = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(cleanName);
    return { cleanName, isImage };
  } catch {
    return { cleanName: "Attachment File", isImage: false };
  }
}

function createFileLabel(url: string, index: number) {
  const filename = getFilenameFromUrl(url);
  return normalizeDocumentLabel(filename) || `Document ${index + 1}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

function parseSubmissionSummary(text?: string) {
  if (!text) return null;
  const normalized = text.replace(/\u00A0/g, " ").replace(/\s*\n\s*/g, " \n ");
  // Try to capture common fields using key:value patterns
  const fields: Record<string, string> = {};
  const kvRegex = /([A-Za-z ]{2,30}):\s*([^\n]+)/g;
  let m;
  while ((m = kvRegex.exec(normalized))) {
    const key = m[1].trim();
    const value = m[2].trim();
    fields[key] = value;
  }

  // Fallbacks: extract email and phone if not found
  if (!fields["Email Address"]) {
    const emailMatch = normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (emailMatch) fields["Email Address"] = emailMatch[0];
  }
  if (!fields["Contact Number"] && !fields["Contact"] && !fields["Phone"]) {
    const phoneMatch = normalized.match(/\+?\d[\d\s\-()]{6,}\d/);
    if (phoneMatch) fields["Contact Number"] = phoneMatch[0];
  }

  // Normalize common keys
  const mapKey = (k: string) => {
    const lower = k.toLowerCase();
    if (lower.includes("applicant name") || lower === "applicant") return "Applicant Name";
    if (lower.includes("school") || lower.includes("institution")) return "School / Institution";
    if (lower.includes("course")) return "Course";
    if (lower.includes("year")) return "Year Level";
    if (lower.includes("email")) return "Email Address";
    if (lower.includes("contact") || lower.includes("phone")) return "Contact Number";
    return k;
  };

  const normalizedFields: Record<string, string> = {};
  Object.keys(fields).forEach((k) => {
    normalizedFields[mapKey(k)] = fields[k];
  });

  // If we only found a tiny amount of data, treat as no summary
  if (Object.keys(normalizedFields).length === 0) return null;
  return normalizedFields;
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
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const coreUploads = useMemo(() => getCoreUploadGroups(application.application?.uploadedFiles), [application.application?.uploadedFiles]);
  const photoUpload = useMemo(() => getPhotoUploadGroup(application.application?.uploadedFiles), [application.application?.uploadedFiles]);

  const submittedFiles = useMemo<SubmittedFile[]>(() => {
    return CORE_UPLOAD_KEYS.map((key) => {
      const upload = coreUploads.find((item) => item.key === key);
      return {
        id: key,
        slotId: key,
        originalUrl: upload?.url || "",
        label: SKEAP_UPLOAD_LABELS[key] || "Document",
        typeLabel: upload?.type || "Missing",
        isImage: upload?.isImage ?? false,
        fileName: upload?.name || (upload?.url ? getFilenameFromUrl(upload.url) : ""),
        isMissing: !upload?.url,
      };
    });
  }, [coreUploads]);

  const activeCorrections = useMemo(() => {
    return submittedFiles.filter((file) => getFileActionHint(application.reviewThread, file));
  }, [submittedFiles, application.reviewThread]);

  const stagedMap = useMemo(() => {
    return stagedReplacements.reduce<Record<string, StagedReplacement>>((collector, replacement) => {
      collector[replacement.slotId] = replacement;
      return collector;
    }, {});
  }, [stagedReplacements]);

  const reviewStatusLabel = application.reviewStatus || "Pending review";
  const normalizedStatus = reviewStatusLabel.toUpperCase();
  const isApproved = normalizedStatus === "APPROVED";
  const isResubmitted = normalizedStatus === "RESUBMITTED";
  const isRejected = normalizedStatus === "REJECTED";
  const hasStagedChanges = stagedReplacements.length > 0;
  const pendingReplacements = stagedReplacements.length;
  const latestRejectionNote = useMemo(() => {
    return application.reviewThread
      .filter((message) => message.role === "admin" && /rejected/i.test(message.text))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.text;
  }, [application.reviewThread]);
  const hasActionRequired = !isRejected && activeCorrections.length > 0 && !isResubmitted;
  const currentDisplayStatus = isRejected
    ? "REJECTED"
    : isResubmitted
    ? "RESUBMITTED"
    : isApproved
    ? "APPROVED"
    : hasStagedChanges
    ? "READY TO RESUBMIT"
    : reviewStatusLabel;

  useEffect(() => {
    if (isApproved) {
      router.push("/grantee-dashboard");
    }
  }, [isApproved, router]);
  const statusBadgeClass = isRejected
    ? "bg-rose-50 text-rose-700 border border-rose-200"
    : isApproved
    ? "bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold"
    : isResubmitted
    ? "bg-sky-100 text-sky-700 border border-sky-200 font-bold"
    : hasStagedChanges
    ? "bg-emerald-100 text-emerald-700"
    : reviewStatusLabel.toLowerCase() === "returned"
    ? "bg-rose-100 text-rose-700"
    : "bg-slate-100 text-slate-700";
  const headerBadgeClass = isApproved
    ? "bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold"
    : isResubmitted
    ? "bg-sky-50 text-sky-700 border border-sky-200 font-bold"
    : "bg-slate-100 text-slate-700";
  const bannerBgClass = isRejected
    ? "bg-rose-50 text-rose-900 border border-rose-200"
    : isResubmitted
    ? "bg-sky-50 text-sky-800 border-sky-200"
    : hasStagedChanges
    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
    : "bg-rose-50 text-rose-700 border-rose-100";
  const bannerMessage = isRejected
    ? "This application has been rejected and is now closed. No further updates are possible."
    : isResubmitted
    ? "Your updated application packet has been delivered to the review team. No further action is required at this time."
    : hasStagedChanges
    ? "All flagged files have been successfully replaced. Review your submission details below."
    : "Fix the flagged files below and resubmit your application.";
  const headerSubtext = isRejected
    ? "Your application process has been finalized. Review the administrative decision details below."
    : "Review feedback is shown first so you can resolve corrections immediately.";
  const isEditLocked = isResubmitted || isRejected;
  const disableResubmit = isResubmitted || isRejected || pendingReplacements === 0 || submitting;
  const disableDelete = isResubmitted || isRejected || submitting;
  const updateCount = application.reviewThread.length;
  const fileCount = submittedFiles.length;
  const presentCount = submittedFiles.filter((f) => !f.isMissing && Boolean(f.originalUrl)).length;
  const resubmittedAtText = application.resubmittedAt ? new Date(application.resubmittedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "numeric" }) : null;

  const handleReplacementSelected = (slotId: string, originalUrl: string, file: File) => {
    if (!ALLOWED_TYPES.has(file.type)) {
      setError("Only PDF, DOCX, PNG, JPG, and WEBP files are allowed.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("File must be smaller than 12MB.");
      return;
    }

    setError(null);
    const existing = stagedMap[slotId];
    if (existing?.previewUrl) URL.revokeObjectURL(existing.previewUrl);

    const previewUrl = URL.createObjectURL(file);
    setStagedReplacements((current) => [
      ...current.filter((replacement) => replacement.slotId !== slotId),
      { slotId, originalUrl, file, previewUrl, status: "pending" },
    ]);
  };

  const handleChooseFile = (slotId: string) => {
    fileInputRefs.current[slotId]?.click();
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
            slotId: replacement.slotId,
            originalUrl: replacement.originalUrl,
            fileUrl: uploadedUrl,
            fileName: replacement.file.name,
            fileType: replacement.file.type || getFileTypeLabel(replacement.file.name),
          };
        })
      );

      const finalUrls = CORE_UPLOAD_KEYS.map((key) => {
        const file = submittedFiles.find((f) => f.slotId === key);
        const replacement = uploads.find((upload) => upload.slotId === key);
        return replacement?.fileUrl ?? file?.originalUrl ?? "";
      });

      const body = {
        urls: finalUrls,
        replacements: uploads,
        message: `Applicant resubmitted files:\n${finalUrls.filter(Boolean).join("\n")}`,
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
      } catch {
        // ignore refresh errors
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete application.");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  const activityEvents = useMemo(
    () =>
      application.reviewThread.map((message) => {
        const date = new Date(message.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        const isSystemNote =
          message.role === "applicant" &&
          !message.attachments?.length &&
          /resubmitted|uploaded|submitted|replacement/i.test(message.text);

        const inlineUrls = extractUrls(message.text || "");
        const attachmentPreviews: AttachmentPreview[] = (message.attachments ?? [])
          .map((attachment) => {
            const url = attachment.fileUrl || "";
            const { cleanName, isImage } = getFileMetadata(url || attachment.fileName || "");
            return {
              url,
              cleanName: attachment.fileName || cleanName,
              isImage,
            };
          })
          .filter((attachment) => attachment.url);

        const inlineAttachmentPreviews = inlineUrls.map((url) => {
          const { cleanName, isImage } = getFileMetadata(url);
          return { url, cleanName, isImage };
        });

        const content = inlineUrls.length
          ? message.text
              .split("\n")
              .filter((line) => !extractUrls(line).length)
              .join(" ")
              .trim() || message.text.trim()
          : message.text.trim();

        return {
          id: message.id,
          type: isSystemNote ? "system" : message.role === "admin" ? "reviewer" : "applicant",
          actor: isSystemNote ? "SYSTEM" : message.role === "admin" ? "SK REVIEW TEAM" : "APPLICANT",
          date,
          content,
          attachments: attachmentPreviews.length > 0 ? attachmentPreviews : inlineAttachmentPreviews,
        };
      }),
    [application.reviewThread]
  );
  const submissionSummary = useMemo(() => parseSubmissionSummary(application.message || undefined), [application.message]);
  const applicationHighlights = isResubmitted ? "RESUBMITTED" : hasActionRequired ? "Correction required" : application.reviewStatus;

  return (
    <div className="space-y-6 pb-32">
      <div className="rounded-3xl border border-slate-100 bg-slate-950/5 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <Link href="/#programs" className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-950">
              <span className="text-lg">←</span>
              Return to programs
            </Link>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Application review</p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-950">Application status</h1>
              <p className="mt-3 max-w-2xl text-sm text-slate-600">
                {headerSubtext}
              </p>
            </div>
          </div>
          <div className="space-y-2 text-right">
            <span className={`inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] ${headerBadgeClass}`}>
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

      {isApproved ? (
        <div className="mb-6 p-6 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-start gap-4 shadow-xs">
          <div className="p-3 bg-emerald-500 text-white rounded-lg text-lg shadow-sm">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-emerald-900 tracking-tight">
              Congratulations! Your application has been approved.
            </h3>
            <p className="text-xs text-emerald-800 font-medium mt-1 leading-relaxed">
              You are officially selected as a program grantee!
            </p>
            <div className="mt-3 p-3 bg-white/80 border border-emerald-100 rounded-lg text-xs text-slate-600 space-y-1.5">
              <p className="font-bold text-slate-700">What happens next?</p>
              <p>
                Your SKEAP application has been approved and your account will be upgraded to <strong>Grantee</strong> access automatically.
              </p>
              <p>
                Your dashboard will transition to the Grantee experience without manual role intervention, and no further document resubmissions are required from your end right now.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {isRejected ? (
        <div className="mb-6 p-5 bg-rose-50/50 border border-rose-200 rounded-xl flex items-start gap-4">
          <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-rose-900">Application Rejection Notice</h3>
            <p className="text-xs text-rose-700 font-semibold mt-1">
              Reason: {latestRejectionNote || "Does not meet eligibility criteria."}
            </p>
            <p className="text-xs text-slate-400 mt-2">
              If you believe this was an error, please contact the SK Review administration directly.
            </p>
          </div>
        </div>
      ) : null}

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
                <div className="space-y-4">
                  {submissionSummary ? (
                    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                      <div className="flex items-start gap-4">
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-slate-900">Applicant submission</h4>
                          <p className="mt-1 text-xs text-slate-500">Initial details from the submitted application for quick review.</p>

                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-sm text-slate-700">
                            {Object.entries(submissionSummary).map(([k, v]) => (
                              <div key={k} className="flex gap-2 items-start">
                                <div className="min-w-[8rem] text-xs text-slate-500">{k}</div>
                                <div className="flex-1 text-sm font-medium text-slate-900 truncate">{v}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="w-24 flex-shrink-0">
                          {application.application?.photoFileUrl ? (
                            <img src={application.application.photoFileUrl} alt={submissionSummary["Applicant Name"] || "Applicant photo"} className="w-24 h-24 object-cover rounded-md border border-slate-100" />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {activityEvents.map((event) => (
                    <div key={event.id} className="relative pl-6">
                      <div className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ${event.type === "system" ? "bg-indigo-500" : "bg-slate-400"} ring-4 ring-white`} />
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className={`font-semibold tracking-tight ${event.type === "system" ? "text-slate-500" : "text-slate-700"}`}>
                            {event.actor}
                          </span>
                          <span className="text-slate-400">{event.date}</span>
                        </div>
                        <div className={`text-sm leading-6 ${event.type === "system" ? "text-slate-600" : "text-slate-700"} break-words whitespace-pre-wrap`}> 
                          {event.content.split("\n").map((line, idx) => (
                            <p key={idx} className="mt-1">{line}</p>
                          ))}
                        </div>

                        {event.attachments.length > 0 ? (
                          <div className="mt-3 flex flex-col gap-3 w-full">
                            {/* Separate images and non-images for clearer layout */}
                            <div className="flex items-start gap-4">
                              <div className="flex-shrink-0 flex items-center gap-2">
                                {event.attachments.filter(a => a.isImage).map((img) => (
                                  <a key={img.url} href={img.url} target="_blank" rel="noopener noreferrer" className="w-20 h-20 overflow-hidden rounded-md border border-slate-200 bg-slate-100 shadow-sm">
                                    <img src={img.url} alt={img.cleanName} className="w-full h-full object-cover" />
                                  </a>
                                ))}
                              </div>
                              <div className="flex-1">
                                <div className="flex flex-wrap gap-2">
                                  {event.attachments.filter(a => !a.isImage).map((attachment) => (
                                    <a
                                      key={attachment.url}
                                      href={attachment.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-100"
                                      title={attachment.cleanName}
                                    >
                                      <FileText className="h-4 w-4 text-slate-400" />
                                      <span className="max-w-[18rem] truncate">{attachment.cleanName}</span>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Application summary</p>
              <div className="mt-4 space-y-4 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-2">
                  <span>Status</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] ${statusBadgeClass}`}>
                    {currentDisplayStatus}
                  </span>
                </div>
                {isRejected ? (
                  <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Available Actions & Next Steps
                      </h4>
                      <p className="mt-1 text-xs text-slate-500 leading-normal">
                        While this specific application is finalized, your account remains active. You can browse other available financial aid, grants, or community programs you may qualify for.
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <a
                        href="/#programs"
                        className="flex-1 text-center bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-all shadow-2xs"
                      >
                        Explore Other Programs
                      </a>
                      <a
                        href="/support/tickets/new"
                        className="flex-1 text-center bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-lg transition-all"
                      >
                        File an Eligibility Appeal
                      </a>
                    </div>
                  </div>
                ) : isApproved ? (
                  <div className="mt-4 rounded-3xl bg-emerald-50 p-4 border border-emerald-200 text-slate-900">
                    <p className="text-sm font-semibold text-emerald-900">Application finalized</p>
                    <p className="mt-2 text-sm text-slate-700">
                      Your approval is complete and this submission is locked. The review team will finish manual onboarding and update your dashboard when the Grantee Profile is configured.
                    </p>
                  </div>
                ) : isResubmitted ? (
                  <div className={`rounded-2xl border px-3 py-3 text-sm ${bannerBgClass}`}>
                    {bannerMessage}
                  </div>
                ) : hasActionRequired ? (
                  <div className={`rounded-2xl border px-3 py-3 text-sm ${bannerBgClass}`}>
                    {bannerMessage}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">No active corrections are required right now.</p>
                )}
                {application.lastUpdatedBy ? <p className="text-sm text-slate-600">Last updated by {application.lastUpdatedBy}</p> : null}

                {!isRejected && !isApproved ? (
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
                        disabled={disableResubmit}
                        onClick={handleResubmit}
                        className={`flex-1 w-full sm:w-auto inline-flex items-center justify-center rounded-3xl px-5 py-3 text-sm font-semibold transition ${disableResubmit ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}
                      >
                        {submitting ? "Resubmitting..." : "Resubmit application"}
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={submitting || deleting}
                    className={`w-full sm:w-auto px-5 py-2.5 rounded-xl border font-medium text-sm transition duration-200 ${submitting || deleting ? "border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed" : "border-red-200 bg-white text-red-600 hover:bg-red-50 hover:border-red-300 active:scale-[0.98]"}`}
                  >
                    {deleting ? "Deleting..." : "Delete Application"}
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Submitted files</p>
              <p className="mt-2 text-sm text-slate-600">The 2x2 ID photo is now separated into the compiled application form. This list shows the 5 core requirements only.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center justify-center whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                5 requirement slots
              </span>
              <button
                type="button"
                onClick={() => setShowApplicationForm(true)}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                View Application Form
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2.5">
              {/* Required uploads checklist - shows core upload slots and their status */}
              <div className="mb-3 flex w-full items-center gap-3">
                <div className="flex items-center gap-3">
                  <p className="text-sm font-medium text-slate-800">Required documents</p>
                  <p className="text-xs text-slate-500">{`${presentCount} of ${CORE_UPLOAD_KEYS.length} provided`}</p>
                </div>
                <div className="ml-4 flex flex-wrap items-center gap-2">
                  {CORE_UPLOAD_KEYS.map((key) => {
                    const slot = submittedFiles.find((f) => f.slotId === key);
                    const present = Boolean(slot && !slot.isMissing && slot.originalUrl);
                    const label = SKEAP_UPLOAD_LABELS[key] || key;
                    return (
                      <div key={key} className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs ${present ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>
                        {present ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        <span className="whitespace-nowrap">{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            {submittedFiles.map((file) => {
              const staged = stagedMap[file.slotId];
              const isReplacementActive = Boolean(staged);
              const correction = getFileActionHint(application.reviewThread, file);
              const previewSrc = staged?.previewUrl ?? file.originalUrl;
              const displayName = staged?.file.name ?? getCleanFilename(stripDatabasePrefix(file.fileName));
              const displayType = staged ? getFileTypeLabel(staged.file.name) : file.typeLabel;
              const displaySize = staged ? formatBytes(staged.file.size) : null;
              const downloadHref = staged?.previewUrl ?? (file.originalUrl || undefined);
              const downloadName = staged?.file.name ?? file.fileName;

              return (
                <div
                  key={file.id}
                  className={`flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3 py-3 transition ${isReplacementActive ? "border-indigo-200 bg-indigo-50/30" : correction ? "border-rose-200 bg-rose-50/40" : ""}`}
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
                        <span className="truncate">{displayType}</span>
                        {displaySize ? <span className="truncate">• {displaySize}</span> : null}
                        {isReplacementActive ? (
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-700">Updated file</span>
                        ) : isResubmitted ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">Awaiting review</span>
                        ) : correction && !isRejected ? (
                          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-red-600">Correction required</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isRejected && !isApproved ? (
                      <button
                        type="button"
                        disabled={isEditLocked}
                        onClick={() => handleChooseFile(file.slotId)}
                        className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${isEditLocked ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "bg-slate-900 text-white hover:bg-slate-800"}`}
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {file.isMissing ? "Upload" : "Replace"}
                      </button>
                    ) : null}
                    {downloadHref ? (
                      <a
                        href={downloadHref}
                        download={downloadName}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700"
                        aria-label={`Download ${displayName}`}
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    ) : null}
                    <input
                      ref={(element) => {
                        fileInputRefs.current[file.slotId] = element;
                      }}
                      type="file"
                      className="hidden"
                      accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(event) => {
                        const selectedFile = event.target.files?.[0];
                        if (selectedFile) {
                          handleReplacementSelected(file.slotId, file.originalUrl, selectedFile);
                        }
                        event.target.value = "";
                      }}
                    />
                  </div>
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

      <SkeapApplicationFormModal
        isOpen={showApplicationForm}
        onClose={() => setShowApplicationForm(false)}
        application={application.application}
        downloadHref={`/api/applications/${application.id}/download`}
      />
    </div>
  );
}
