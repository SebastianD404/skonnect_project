"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FloatingFeedback from "@/app/components/FloatingFeedback";
import { ArrowLeft, ArrowUpRight, CalendarDays, CheckCircle2, Eye, FileText, Inbox, Info, LoaderCircle, MessageCircle, Trash2, Upload, UserRound, X } from "lucide-react";
import SkeapApplicationFormModal from "@/components/SkeapApplicationFormModal";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { getCoreUploadGroups, getPhotoUploadGroup, CORE_UPLOAD_KEYS, SKEAP_UPLOAD_LABELS } from "@/lib/skeap-upload";
import {
  isSkeapApplicationReturned,
  isSkeapUploadMarkedForCorrection,
} from "@/lib/skeap-application-status";
import { formatActivityTimestamp } from "@/lib/utils";
import { scanGradeReportFile } from "@/lib/ocr/client-grade-report";
import type { GradeReportDiagnostics } from "@/lib/grade-report-parser";

type ReviewAttachment = {
  fileId: string;
  documentLabel?: string;
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
  action?: "return";
  eventType?: "RESUBMISSION";
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
    waitlistStatus?: {
      isWaitlisted: boolean;
      queuePosition: number | null;
      totalWaitlisted: number;
      isCycleClosedAndFull: boolean;
    };
    application?: {
      id: string;
      status?: string;
      waitlistRemark?: string | null;
      school?: string;
      educationLevel?: string;
      currentCourse?: string;
      yearLevel?: string;
      gwa?: number | null;
      applicantName?: string;
      permanentAddress?: string;
      purok?: string;
      sitio?: string;
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
  status: "uploading" | "uploaded";
  uploadedUrl?: string;
  gradeDiagnostics?: GradeReportDiagnostics | null;
  ocrStatus?: "OCR_DONE" | "OCR_NEEDS_REVIEW" | "OCR_FAILED";
};

type SubmittedFile = {
  id: string;
  slotId: string;
  originalUrl: string;
  label: string;
  typeLabel: string;
  fileType?: string;
  isImage: boolean;
  fileName: string;
  pendingResubmission?: boolean;
  isMissing?: boolean;
  gradeDiagnostics?: GradeReportDiagnostics | null;
  ocrStatus?: "OCR_DONE" | "OCR_NEEDS_REVIEW" | "OCR_FAILED";
};

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const WITHDRAWABLE_APPLICATION_STATUSES = new Set([
  "PENDING",
  "UNDER_REVIEW",
  "PRE_QUALIFIED",
  "RETURNED",
  "RETURNED_FOR_EDIT",
  "WAITLISTED",
]);
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

type AttachmentPreview = {
  url: string;
  cleanName: string;
  isImage: boolean;
  isPdf: boolean;
};

function getFileMetadata(url: string) {
  try {
    const decodedUrl = decodeURIComponent(url);
    let fileNameWithTokens = decodedUrl.substring(decodedUrl.lastIndexOf("/") + 1);
    fileNameWithTokens = fileNameWithTokens.split("?")[0].split("#")[0];
    const cleanName = fileNameWithTokens.replace(/^\d+-/, "") || "Attachment File";
    const isImage = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(cleanName);
    const isPdf = /\.pdf$/i.test(cleanName);
    return { cleanName, isImage, isPdf };
  } catch {
    return { cleanName: "Attachment File", isImage: false, isPdf: false };
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
  return isSkeapUploadMarkedForCorrection(reviewThread, file);
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

function DetailItem({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      <span className="truncate text-xs font-medium text-slate-900" title={value || "N/A"}>
        {value || "N/A"}
      </span>
    </div>
  );
}

async function uploadDocument(
  applicationId: string,
  slotId: string,
  file: File,
  gradeDiagnostics?: GradeReportDiagnostics | null,
  ocrStatus?: "OCR_DONE" | "OCR_NEEDS_REVIEW" | "OCR_FAILED",
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("slotId", slotId);
  if (slotId === "gradeReport") {
    formData.append("gradeDiagnostics", JSON.stringify(gradeDiagnostics ?? null));
    formData.append("ocrStatus", ocrStatus ?? "OCR_FAILED");
  }
  const response = await fetch(`/api/applications/${applicationId}/resubmit/upload`, {
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
  useAutoRefresh(6_000);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const activityScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const previousActivityLengthRef = useRef<number | null>(null);
  const activityApplicationIdRef = useRef(application.id);
  const [isActivityNearBottom, setIsActivityNearBottom] = useState(true);
  const [stagedReplacements, setStagedReplacements] = useState<StagedReplacement[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lifecycleAction, setLifecycleAction] = useState<"delete" | "withdraw" | null>(null);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [isProcessingLifecycleAction, setIsProcessingLifecycleAction] = useState(false);
  const [hasWithdrawn, setHasWithdrawn] = useState(
    application.application?.status?.toUpperCase() === "WITHDRAWN",
  );

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
        fileType: upload?.fileType,
        isImage: upload?.isImage ?? false,
        fileName: upload?.name || (upload?.url ? getFilenameFromUrl(upload.url) : ""),
        pendingResubmission: upload?.pendingResubmission,
        isMissing: !upload?.url,
        gradeDiagnostics: upload?.gradeDiagnostics,
        ocrStatus: upload?.ocrStatus,
      };
    });
  }, [coreUploads]);

  const stagedMap = useMemo(() => {
    return stagedReplacements.reduce<Record<string, StagedReplacement>>((collector, replacement) => {
      collector[replacement.slotId] = replacement;
      return collector;
    }, {});
  }, [stagedReplacements]);

  const reviewStatusLabel = application.reviewStatus || "Pending review";
  const applicationStatus = (application.application?.status || reviewStatusLabel).trim().toUpperCase();
  const isWithdrawn = hasWithdrawn || applicationStatus === "WITHDRAWN";
  const normalizedStatus = isWithdrawn ? "WITHDRAWN" : reviewStatusLabel.toUpperCase();
  const isAgedOutWaitlisted = application.application?.waitlistRemark === "AGED_OUT";
  const isWaitlistCycleClosed = application.application?.waitlistRemark === "CYCLE_CLOSED";
  const isWaitlistClosed = isAgedOutWaitlisted || isWaitlistCycleClosed;
  const isDraft = applicationStatus === "DRAFT";
  const canWithdraw = !isWithdrawn && WITHDRAWABLE_APPLICATION_STATUSES.has(applicationStatus);
  const isApproved = normalizedStatus === "APPROVED";
  const isResubmitted = normalizedStatus === "RESUBMITTED";
  const isRejected = normalizedStatus === "REJECTED" && !isAgedOutWaitlisted && !isWaitlistCycleClosed;
  const isApplicationReturned = isSkeapApplicationReturned(reviewStatusLabel);
  const canResubmit = !isWithdrawn && isApplicationReturned &&
    ["RETURNED", "RETURNED_FOR_EDIT"].includes(applicationStatus);
  const activeCorrections = useMemo(
    () => canResubmit
      ? submittedFiles.filter((file) => getFileActionHint(application.reviewThread, file))
      : [],
    [canResubmit, submittedFiles, application.reviewThread]
  );
  const isUploadingReplacement = stagedReplacements.some((replacement) => replacement.status === "uploading");
  const pendingReplacementKeys = new Set([
    ...submittedFiles.filter((file) => file.pendingResubmission).map((file) => file.slotId),
    ...stagedReplacements
      .filter((replacement) => replacement.status === "uploaded")
      .map((replacement) => replacement.slotId),
  ]);
  const pendingReplacements = pendingReplacementKeys.size;
  const hasSavedReplacements = pendingReplacements > 0;
  const latestRejectionNote = useMemo(() => {
    const note = application.reviewThread
      .filter((message) => message.role === "admin" && /reject/i.test(message.text))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.text;
    return note?.replace(/^(?:application\s+rejected|reason\s+for\s+rejection|rejection\s+reason)\s*:\s*/i, "");
  }, [application.reviewThread]);
  const hasActionRequired = canResubmit && !isRejected && activeCorrections.length > 0 && !isResubmitted;
  const currentDisplayStatus = isWithdrawn
    ? "WITHDRAWN"
    : isAgedOutWaitlisted
    ? "CLOSED — AGE LIMIT"
    : isWaitlistCycleClosed
    ? "CLOSED"
    : isRejected
    ? "REJECTED"
    : isResubmitted
    ? "RESUBMITTED"
    : isApproved
    ? "APPROVED"
    : hasSavedReplacements
    ? "READY TO RESUBMIT"
    : reviewStatusLabel;

  useEffect(() => {
    if (!lifecycleAction || isProcessingLifecycleAction) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLifecycleAction(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isProcessingLifecycleAction, lifecycleAction]);

  useEffect(() => {
    if (isApproved) {
      router.push("/grantee-dashboard");
    }
  }, [isApproved, router]);
  const statusBadgeClass = isRejected
    ? "bg-rose-50 text-rose-700 border border-rose-200"
    : isAgedOutWaitlisted || isWaitlistCycleClosed
    ? "bg-slate-100 text-slate-700 border border-slate-200"
    : isApproved
    ? "bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold"
    : isWithdrawn
    ? "bg-slate-100 text-slate-600 border border-slate-200"
    : isResubmitted
    ? "bg-sky-100 text-sky-700 border border-sky-200 font-bold"
    : hasSavedReplacements
    ? "bg-emerald-100 text-emerald-700"
    : reviewStatusLabel.toLowerCase() === "returned"
    ? "bg-amber-50 text-amber-700 border border-amber-200"
    : "bg-slate-100 text-slate-700";
  const bannerBgClass = isRejected
    ? "bg-rose-50 text-rose-900 border border-rose-200"
    : isAgedOutWaitlisted || isWaitlistCycleClosed
    ? "bg-slate-50 text-slate-800 border border-slate-200"
    : isResubmitted
    ? "bg-sky-50 text-sky-800 border-sky-200"
    : hasSavedReplacements
    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
    : "bg-rose-50 text-rose-700 border-rose-100";
  const bannerMessage = isRejected
    ? "This application has been rejected and is now closed. No further updates are possible."
    : isAgedOutWaitlisted
    ? "Your application was closed because you reached the program’s maximum eligible age while on the waitlist."
    : isWaitlistCycleClosed
    ? "This application was closed when the SKEAP cycle ended and will not carry over to a future cycle."
    : isResubmitted
    ? "Your updated application packet has been delivered to the review team. No further action is required at this time."
    : isUploadingReplacement
    ? "Saving your replacement file. Please keep this page open until the upload finishes."
    : hasSavedReplacements
    ? "Your replacement files are saved. Resubmit them when you are ready."
    : "Fix the flagged files below and resubmit your application.";
  const headerSubtext = isRejected
    ? "Your application process has been finalized. Review the administrative decision details below."
    : isAgedOutWaitlisted
    ? "Your waitlisted application was closed after you exceeded the program’s age limit."
    : isWaitlistCycleClosed
    ? "Your waitlisted application was closed at the end of the SKEAP cycle."
    : "Review feedback is shown first so you can resolve corrections immediately.";
  const isEditLocked = !canResubmit || isResubmitted || isRejected || isApproved || isWithdrawn;
  const disableResubmit = !canResubmit || isResubmitted || isRejected || pendingReplacements === 0 || isUploadingReplacement || submitting;
  const fileCount = submittedFiles.length;
  const resubmittedAtText = application.resubmittedAt ? new Date(application.resubmittedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "numeric" }) : null;

  const handleReplacementSelected = async (slotId: string, originalUrl: string, file: File) => {
    if (isEditLocked || isUploadingReplacement) return;
    if (!ALLOWED_TYPES.has(file.type)) {
      setError("Only PDF, DOCX, PNG, JPG, and WEBP files are allowed.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("File must not exceed 15MB.");
      return;
    }

    setError(null);
    setActionError(null);
    const existing = stagedMap[slotId];
    if (existing?.previewUrl) URL.revokeObjectURL(existing.previewUrl);

    const previewUrl = URL.createObjectURL(file);
    setStagedReplacements((current) => [
      ...current.filter((replacement) => replacement.slotId !== slotId),
      { slotId, originalUrl, file, previewUrl, status: "uploading" },
    ]);

    try {
      let gradeDiagnostics: GradeReportDiagnostics | null = null;
      let ocrStatus: "OCR_DONE" | "OCR_NEEDS_REVIEW" | "OCR_FAILED" | undefined;
      if (slotId === "gradeReport") {
        try {
          const scan = await scanGradeReportFile(file);
          gradeDiagnostics = scan.diagnostics;
          ocrStatus = scan.ocrStatus;
        } catch (scanError) {
          console.error("Grade Report OCR failed during SKEAP resubmission.", scanError);
          ocrStatus = "OCR_FAILED";
        }
      }
      const uploadedUrl = await uploadDocument(
        application.id,
        slotId,
        file,
        gradeDiagnostics,
        ocrStatus,
      );
      URL.revokeObjectURL(previewUrl);
      setStagedReplacements((current) =>
        current.map((replacement) =>
          replacement.slotId === slotId
            ? {
                ...replacement,
                previewUrl: "",
                uploadedUrl,
                status: "uploaded",
                ...(slotId === "gradeReport" ? { gradeDiagnostics, ocrStatus } : {}),
              }
            : replacement
        )
      );
      router.refresh();
    } catch (uploadError) {
      URL.revokeObjectURL(previewUrl);
      setStagedReplacements((current) => current.filter((replacement) => replacement.slotId !== slotId));
      setActionError(uploadError instanceof Error ? uploadError.message : "Unable to save replacement file.");
    }
  };

  const handleChooseFile = (slotId: string) => {
    if (isEditLocked || isUploadingReplacement) return;
    fileInputRefs.current[slotId]?.click();
  };

  const handleResubmit = async () => {
    if (!isApplicationReturned || isResubmitted || isRejected) {
      setError("Your application can only be resubmitted after it has been returned for edits.");
      return;
    }
    if (pendingReplacements === 0 || isUploadingReplacement) {
      setError("Select at least one file replacement before resubmitting.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setActionError(null);
    setSuccess(null);

    try {
      const uploads = submittedFiles.flatMap((file) => {
        const staged = stagedMap[file.slotId];
        if (staged?.status === "uploaded" && staged.uploadedUrl) {
          return [{
            slotId: file.slotId,
            originalUrl: file.originalUrl,
            fileUrl: staged.uploadedUrl,
            fileName: staged.file.name,
            fileType: staged.file.type || getFileTypeLabel(staged.file.name),
            ...(file.slotId === "gradeReport"
              ? {
                  gradeDiagnostics: staged.gradeDiagnostics,
                  ocrStatus: staged.ocrStatus,
                }
              : {}),
          }];
        }
        if (file.pendingResubmission) {
          return [{
            slotId: file.slotId,
            originalUrl: file.originalUrl,
            fileUrl: file.originalUrl,
            fileName: file.fileName,
            fileType: file.fileType || getFileTypeLabel(file.originalUrl),
          }];
        }
        return [];
      });

      const finalUrls = CORE_UPLOAD_KEYS.map((key) => {
        const file = submittedFiles.find((f) => f.slotId === key);
        const replacement = uploads.find((upload) => upload.slotId === key);
        return replacement?.fileUrl ?? file?.originalUrl ?? "";
      });

      const body = {
        urls: finalUrls,
        replacements: uploads,
        message: "Applicant resubmitted replacement files for review.",
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
      router.refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to resubmit application.");
    } finally {
      setSubmitting(false);
    }
  };

  async function handleLifecycleAction() {
    if (!lifecycleAction || isProcessingLifecycleAction) return;
    setIsProcessingLifecycleAction(true);
    setError(null);
    setActionError(null);
    try {
      const isDeletingDraft = lifecycleAction === "delete";
      const response = await fetch(
        isDeletingDraft
          ? `/api/applications/${application.id}/delete`
          : `/api/applications/${application.id}/cancel`,
        {
          method: isDeletingDraft ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
          ...(!isDeletingDraft ? { body: JSON.stringify({ action: "WITHDRAW" }) } : {}),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || (isDeletingDraft ? "Unable to delete draft." : "Unable to withdraw application."));
      }

      setLifecycleAction(null);
      if (isDeletingDraft) {
        setSuccess("Your draft has been deleted.");
        router.push("/applications");
        router.refresh();
      } else {
        setHasWithdrawn(true);
        setSuccess("Application withdrawn. Your record has been archived.");
        router.refresh();
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to update application status.");
    } finally {
      setIsProcessingLifecycleAction(false);
    }
  }

  const activityEvents = useMemo(
    () =>
      [...application.reviewThread]
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .filter(
          (message) =>
            !(
              isRejected &&
              message.role === "admin" &&
              /^(?:application rejected|reason for rejection)\s*:/i.test(message.text.trim())
            )
        )
        .map((message) => {
        const date = formatActivityTimestamp(message.createdAt);
        const isSystemNote =
          message.role === "applicant" &&
          !message.attachments?.length &&
          /resubmitted|uploaded|submitted|replacement/i.test(message.text);

        const inlineUrls = extractUrls(message.text || "");
        const attachmentPreviews: AttachmentPreview[] = (message.attachments ?? [])
          .map((attachment) => {
            const url = attachment.fileUrl || "";
            const { cleanName, isImage, isPdf: urlIsPdf } = getFileMetadata(url || attachment.fileName || "");
            return {
              url,
              cleanName: attachment.fileName || cleanName,
              isImage,
              isPdf: attachment.fileType.toLowerCase() === "application/pdf" || urlIsPdf,
            };
          })
          .filter((attachment) => attachment.url);

        const inlineAttachmentPreviews = inlineUrls.map((url) => {
          const { cleanName, isImage, isPdf } = getFileMetadata(url);
          return { url, cleanName, isImage, isPdf };
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
    [application.reviewThread, isRejected]
  );
  const [lastReadActivityLength, setLastReadActivityLength] = useState(activityEvents.length);
  const submissionSummary = useMemo(() => parseSubmissionSummary(application.message || undefined), [application.message]);
  const showReviewActivity = activityEvents.length > 0 || normalizedStatus === "RETURNED";
  const hasNewActivity = !isActivityNearBottom && activityEvents.length > lastReadActivityLength;

  useEffect(() => {
    if (!showReviewActivity) return;

    const container = activityScrollContainerRef.current;
    const isInitialOrNewApplication = previousActivityLengthRef.current === null || activityApplicationIdRef.current !== application.id;
    if (isInitialOrNewApplication) {
      if (container && activityEvents.length > 0) container.scrollTop = container.scrollHeight;
      previousActivityLengthRef.current = activityEvents.length;
      activityApplicationIdRef.current = application.id;
      return;
    }

    if (activityEvents.length > (previousActivityLengthRef.current ?? 0)) {
      if (isActivityNearBottom) {
        container?.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      }
    }

    previousActivityLengthRef.current = activityEvents.length;
  }, [activityEvents.length, application.id, isActivityNearBottom, showReviewActivity]);

  const handleActivityScroll = () => {
    const container = activityScrollContainerRef.current;
    if (!container) return;

    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setIsActivityNearBottom(nearBottom);
    if (nearBottom) setLastReadActivityLength(activityEvents.length);
  };

  const scrollToLatestActivity = () => {
    const container = activityScrollContainerRef.current;
    if (!container) return;

    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    setIsActivityNearBottom(true);
    setLastReadActivityLength(activityEvents.length);
  };

  return (
    <div className="space-y-6 pb-32">
      <header className="mb-8 w-full rounded-2xl border border-cyan-950/20 bg-[linear-gradient(120deg,#0f3d5c_0%,#145b72_58%,#e7f4f1_160%)] p-6 shadow-sm md:p-8">
        <Link href="/applications" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-white/75 transition-colors hover:text-white">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Return to applications
        </Link>

        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-white/75">Application Review</p>
            <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-white">Application status</h1>
            <div className="flex items-center gap-3">
              <p className="text-sm text-white/85">{headerSubtext}</p>
            </div>
          </div>

          <div className="shrink-0">
            <div className="flex w-fit items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white/80">
              <CalendarDays className="h-4 w-4 text-white/75" aria-hidden="true" />
              <span>
                Submitted <span className="font-semibold text-white">{new Date(application.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
              </span>
            </div>
            {resubmittedAtText ? <p className="mt-1 text-right text-xs text-white/75">Resubmitted on {resubmittedAtText}</p> : null}
          </div>
        </div>
      </header>

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

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
        <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 rounded-t-2xl border-b border-slate-100 bg-white p-5">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-500" aria-hidden="true" />
              <h2 className="text-sm font-bold text-slate-900">Application summary</h2>
            </div>
            {normalizedStatus === "WAITLISTED" ? (
              <span className="group relative inline-flex shrink-0 cursor-help items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-700" tabIndex={0} aria-label="Waitlisted status information">
                WAITLISTED
                <Info className="h-3.5 w-3.5" aria-hidden="true" />
                <span role="tooltip" className="pointer-events-none absolute bottom-full right-0 z-50 mb-2 w-72 max-w-[calc(100vw-3rem)] rounded-lg bg-slate-900 p-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  Program slots are currently full. You have been placed on a reservation list and will be contacted if slots become vacant. (First-come, first-served basis).
                </span>
              </span>
            ) : (
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${statusBadgeClass}`}>
                {currentDisplayStatus}
              </span>
            )}
          </div>

          <div className="flex flex-1 flex-col gap-5 p-5">
            {application.waitlistStatus?.isWaitlisted && !isWithdrawn ? (
              application.waitlistStatus.isCycleClosedAndFull ? (
                <section aria-label="Final SKEAP waitlist status" className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <span className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-bold tabular-nums text-slate-700">
                    Final Queue Position: #{application.waitlistStatus.queuePosition ?? "—"}
                  </span>
                  <p className="mt-3 text-sm font-semibold text-slate-800">
                    Thank you for applying. The slots are already full and closed.
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Your final position in the waitlist queue was #{application.waitlistStatus.queuePosition ?? "—"} of {application.waitlistStatus.totalWaitlisted}.
                  </p>
                </section>
              ) : (
                <section aria-label="SKEAP waitlist status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <span className="inline-flex rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-bold tabular-nums text-amber-800">
                    Queue Position: #{application.waitlistStatus.queuePosition ?? "—"}
                  </span>
                  <p className="mt-3 text-sm leading-relaxed text-amber-900">
                    All slots are currently filled. You are <strong>#{application.waitlistStatus.queuePosition ?? "—"}</strong> in the waitlist queue, and we will notify you if a slot opens up.
                  </p>
                </section>
              )
            ) : null}
            {isAgedOutWaitlisted || isWaitlistCycleClosed ? (
              <section
                aria-label="SKEAP waitlist closure notice"
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                role="status"
              >
                <p className="text-xs font-semibold text-slate-800">
                  {isAgedOutWaitlisted ? "Waitlist application closed — age limit reached" : "SKEAP waitlist cycle closed"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{bannerMessage}</p>
              </section>
            ) : null}
            <section aria-label="Applicant context" className="flex items-start gap-4">
                {application.application?.photoFileUrl ? (
                  <img
                    src={application.application.photoFileUrl}
                    alt={submissionSummary?.["Applicant Name"] || application.application.applicantName || "Applicant"}
                    className="h-14 w-14 shrink-0 rounded-xl border border-slate-200 object-cover shadow-sm"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100">
                    <UserRound className="h-6 w-6 text-slate-300" aria-hidden="true" />
                  </div>
                )}
                <div className="mt-0.5 min-w-0 flex-1 space-y-0.5">
                  <h3 className="truncate text-base font-bold text-slate-900">
                    {submissionSummary?.["Applicant Name"] || application.application?.applicantName || "Applicant"}
                  </h3>
                  <p className="truncate text-xs text-slate-500">
                    {submissionSummary?.["Email Address"] || application.application?.emailAddress || "N/A"}
                  </p>
                </div>
            </section>

            <div className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
              <DetailItem label="School / Institution" value={submissionSummary?.["School / Institution"] || application.application?.school} />
              <DetailItem label="Year Level" value={submissionSummary?.["Year Level"] || application.application?.yearLevel} />
              <DetailItem label="Education Level" value={application.application?.educationLevel} />
              {application.application?.currentCourse !== "N/A" ? (
                <DetailItem label={application.application?.educationLevel === "Senior High School" ? "Academic / TVL Strand" : "Course"} value={submissionSummary?.Course || application.application?.currentCourse} />
              ) : null}
              <DetailItem label="Contact Number" value={submissionSummary?.["Contact Number"] || application.application?.contactNumber} />
              <div className="border-t border-slate-200/60 pt-3">
                <DetailItem
                  label="Age"
                  value={application.application?.age != null ? `${application.application.age} years old` : undefined}
                />
              </div>
              <div className="border-t border-slate-200/60 pt-3">
                <DetailItem
                  label="Sitio"
                  value={application.application?.purok || application.application?.sitio}
                />
              </div>
            </div>

            <div className="space-y-5 text-sm text-slate-600">
              {isRejected ? (
                <div className="mt-auto space-y-2 rounded-xl border border-rose-100 bg-rose-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold text-rose-800">Application Rejected</p>
                    {application.lastUpdatedBy ? (
                      <span className="text-[10px] text-rose-400">By {application.lastUpdatedBy}</span>
                    ) : null}
                  </div>
                  <p className="text-xs text-rose-600"><span className="font-semibold">Reason:</span> {latestRejectionNote || "Does not meet eligibility criteria."}</p>
                  <p className="text-[11px] text-rose-500">If you believe this was an error, contact the SK Review administration directly.</p>
                </div>
              ) : isApproved ? (
                <div className="rounded-[1.75rem] border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-semibold text-emerald-900">Application approved</p>
                  <p className="mt-2 text-sm text-slate-700">Your application has been approved and onboarding is in progress.</p>
                </div>
              ) : canResubmit ? (
                <div className="mb-5 rounded-r-lg border-l-4 border-cyan-500 bg-cyan-50 p-4">
                  <p className="text-sm leading-relaxed text-slate-700">
                    {isUploadingReplacement
                      ? "Saving replacement file..."
                      : pendingReplacements > 0
                      ? `${pendingReplacements} replacement file${pendingReplacements > 1 ? "s" : ""} saved and ready to send.`
                      : "Choose at least one file replacement to activate resubmission."}
                  </p>
                </div>
              ) : null}

              <div>
                {canResubmit && !isRejected && !isApproved ? (
                  <button
                    type="button"
                    disabled={disableResubmit}
                    onClick={handleResubmit}
                    className={`flex w-full items-center justify-center gap-2 rounded-lg py-2.5 font-medium transition-colors ${disableResubmit ? "cursor-not-allowed bg-slate-100 text-slate-500" : "bg-slate-900 text-white hover:bg-slate-800"}`}
                  >
                    {submitting ? "Resubmitting..." : "Resubmit application"}
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </div>

          </div>
          <footer className="mt-auto border-t border-slate-100 bg-slate-50/50 p-5">
            {isDraft || canWithdraw ? (
              <button
                type="button"
                onClick={() => setLifecycleAction(isDraft ? "delete" : "withdraw")}
                disabled={submitting || isProcessingLifecycleAction}
                className={`flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition-colors ${
                  submitting || isProcessingLifecycleAction
                    ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500"
                    : isDraft
                      ? "border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                      : "border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                }`}
              >
                {isDraft ? (
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <X className="h-4 w-4" aria-hidden="true" />
                )}
                {isProcessingLifecycleAction
                  ? isDraft ? "Deleting draft..." : "Withdrawing..."
                  : isDraft ? "Delete Draft" : "Withdraw Application"}
              </button>
            ) : null}
          </footer>

        </div>
        </div>

        <div className="min-w-0 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_20px_40px_rgba(15,23,42,0.05)] lg:col-span-2">
          <div className="border-b border-slate-100 bg-slate-50 p-5 pb-2">
            <div>
              <h2 className="mb-2 text-lg font-bold text-slate-900">Submitted files</h2>
              <p className="text-sm leading-relaxed text-slate-500">
                The 2x2 photo is included in your{" "}
                <button
                  type="button"
                  onClick={() => setShowApplicationForm(true)}
                  className="inline font-medium text-blue-600 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                >
                  compiled application form<FileText className="ml-1 mb-0.5 inline-block h-4 w-4 align-middle text-current" aria-hidden="true" />
                </button>. Files below are matched to their core requirements.
              </p>
            </div>
          </div>

          <div className="mt-5 min-w-0 space-y-2 px-4 pb-4 pt-0">
              {submittedFiles.map((file) => {
                const staged = stagedMap[file.slotId];
                const isReplacementActive = Boolean(
                  staged?.status === "uploading" || staged?.status === "uploaded" || file.pendingResubmission
                );
                const correction = isApplicationReturned && getFileActionHint(application.reviewThread, file);
                const previewSrc = staged?.uploadedUrl ?? staged?.previewUrl ?? file.originalUrl;
                const displayName = staged?.file.name ?? (file.isMissing ? "No file uploaded" : getCleanFilename(stripDatabasePrefix(file.fileName)));
                const displayType = staged ? getFileTypeLabel(staged.file.name) : file.typeLabel;
                const displaySize = staged ? formatBytes(staged.file.size) : null;
                const downloadHref = staged?.uploadedUrl ?? staged?.previewUrl ?? (file.originalUrl || undefined);

                return (
                  <div
                    key={file.id}
                    className={`flex min-w-0 items-center gap-3 rounded-xl border p-3 transition ${isReplacementActive ? "border-indigo-200 bg-indigo-50/30" : correction ? "border-rose-200 bg-rose-50/40" : "border-slate-100 bg-white"}`}
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
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
                        <FileText className="h-5 w-5 text-sky-700" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900" title={displayName}>{displayName}</p>
                      <p className="truncate text-xs text-slate-500" title={`${file.isMissing ? "Required" : "Fulfills"}: ${file.label}`}>
                        {file.isMissing ? "Required" : "Fulfills"}: {file.label}
                      </p>
                      <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
                          <span>{displayType}</span>
                          {displaySize ? <span>• {displaySize}</span> : null}
                          {isReplacementActive ? (
                            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-700">Updated</span>
                          ) : isResubmitted ? (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">Pending</span>
                          ) : correction && !isRejected && !isWaitlistClosed ? (
                            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-red-600">Need Correction</span>
                          ) : null}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {!isRejected && !isApproved && !isWaitlistClosed ? (
                        <button
                          type="button"
                          disabled={isEditLocked || isUploadingReplacement}
                          onClick={() => handleChooseFile(file.slotId)}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${isEditLocked || isUploadingReplacement ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "bg-slate-900 text-white hover:bg-slate-800"}`}
                        >
                          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                          {file.isMissing ? "Upload" : "Replace"}
                        </button>
                      ) : null}
                      {downloadHref ? (
                        <a
                          href={downloadHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700"
                          aria-label={`View file ${displayName}`}
                          title={`View file ${displayName}`}
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
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
                            void handleReplacementSelected(file.slotId, file.originalUrl, selectedFile);
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

      {showReviewActivity ? (
        <section className="w-full rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 className="text-base font-bold text-slate-900">Review activity</h2>
            <span className={`ml-auto inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide ${hasActionRequired ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
              {`${activityEvents.length} ${activityEvents.length === 1 ? "update" : "updates"}`.toUpperCase()}
            </span>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-slate-500">Messages and updates from you and the SK review team.</p>
          <div className="relative">
            <div ref={activityScrollContainerRef} onScroll={handleActivityScroll} className="max-h-[450px] space-y-5 overflow-y-auto pr-2">
              {activityEvents.length === 0 ? (
                <div className="flex items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                  <span className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500">
                    <Inbox className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <p className="text-sm text-slate-500">No additional review activity yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activityEvents.map((event) => (
                    <div key={event.id} className="relative pl-6">
                      <div
                        className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ${
                          event.type === "reviewer"
                            ? "bg-cyan-600"
                            : event.type === "system"
                            ? "bg-indigo-500"
                            : "bg-slate-400"
                        } ring-4 ring-white`}
                      />
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className={`font-semibold tracking-tight ${event.type === "system" ? "text-slate-500" : "text-slate-700"}`}>
                            {event.actor}
                          </span>
                          <span className="text-slate-400">{event.date}</span>
                        </div>
                        <div className={`break-words whitespace-pre-wrap text-sm leading-6 ${event.type === "system" ? "text-slate-600" : "text-slate-700"}`}>
                          {event.content.split("\n").map((line, idx) => (
                            <p key={idx} className="mt-1">{line}</p>
                          ))}
                        </div>
                        {event.attachments.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2.5">
                            {event.attachments.map((file, index) => (
                              <a
                                key={`${file.url}-${index}`}
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group relative flex h-20 w-20 flex-col items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm transition-all hover:border-slate-400"
                                title={file.cleanName}
                                aria-label={`View attachment ${file.cleanName}`}
                              >
                                {file.isImage ? (
                                  <img
                                    src={file.url}
                                    alt={file.cleanName || "Attachment"}
                                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                                  />
                                ) : (
                                  <div className="flex flex-col items-center justify-center p-2 text-center text-slate-500">
                                    <svg className={`mb-1 h-7 w-7 ${file.isPdf ? "text-red-500" : "text-slate-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    <span className="w-full truncate text-[9px] font-bold uppercase tracking-tighter text-slate-600">
                                      {file.isPdf ? "PDF" : file.cleanName.split(".").pop() || "File"}
                                    </span>
                                  </div>
                                )}
                                <div className="absolute inset-0 flex items-end bg-slate-900/0 p-1 transition-colors group-hover:bg-slate-900/10">
                                  <span className="w-full truncate rounded bg-slate-900/80 px-1 text-center text-[8px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                                    View
                                  </span>
                                </div>
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {hasNewActivity ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center">
                <button
                  type="button"
                  onClick={scrollToLatestActivity}
                  className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-teal-500 bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-lg transition-colors hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                  aria-label="Scroll to the newest review activity"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  New message
                </button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {error ? <div role="alert" className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}
      {actionError ? <FloatingFeedback message={actionError} type="error" autoDismissMs={4000} onDismiss={() => setActionError(null)} /> : null}
      {success ? (
        <FloatingFeedback message={success} type="success" autoDismissMs={4500} onDismiss={() => setSuccess(null)} />
      ) : null}

      {lifecycleAction ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget && !isProcessingLifecycleAction) {
              setLifecycleAction(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="application-lifecycle-title"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 id="application-lifecycle-title" className="text-lg font-semibold text-slate-900">
                  {lifecycleAction === "delete" ? "Delete this draft?" : "Withdraw your application?"}
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  {lifecycleAction === "delete"
                    ? "Delete this unsubmitted draft? This cannot be undone."
                    : "Withdrawing your application removes you from active consideration (and forfeits your current waitlist position, if any). Your submission record will remain archived for Barangay Pico SK audit purposes."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLifecycleAction(null)}
                disabled={isProcessingLifecycleAction}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                aria-label="Close confirmation"
              >
                <X />
              </button>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setLifecycleAction(null)}
                disabled={isProcessingLifecycleAction}
                className="rounded-3xl border border-slate-200 px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleLifecycleAction()}
                disabled={isProcessingLifecycleAction}
                aria-busy={isProcessingLifecycleAction}
                className={`inline-flex items-center gap-2 rounded-3xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                  lifecycleAction === "delete" ? "bg-rose-600 hover:bg-rose-700" : "bg-slate-900 hover:bg-slate-800"
                }`}
              >
                {isProcessingLifecycleAction ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                    {lifecycleAction === "delete" ? "Deleting draft..." : "Withdrawing..."}
                  </>
                ) : lifecycleAction === "delete" ? "Delete Draft" : "Withdraw Application"}
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
