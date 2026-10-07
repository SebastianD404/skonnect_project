"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowRight, ArrowUpRight, CheckCircle, CheckCircle2, ChevronLeft, ChevronRight, Clock, CornerUpLeft, Eye, FileText, FolderOpen, RefreshCcw, RefreshCw, Send, X, type LucideIcon } from "lucide-react";
import RejectApplicationModal from "./RejectApplicationModal";
import SkeapApplicationFormModal from "@/components/SkeapApplicationFormModal";
import {
  CORE_UPLOAD_KEYS,
  getLatestSkeapResubmissionUploadKeys,
  SKEAP_UPLOAD_KEY,
  SKEAP_UPLOAD_LABELS,
  SKEAP_UPLOAD_ORDER,
} from "@/lib/skeap-upload";
import { normalizeSkeapSchoolName } from "@/lib/skeap-school";
import { formatActivityTimestamp } from "@/lib/utils";

interface DocumentItem {
  id: string;
  label: string;
  type: string;
  previewUrl: string;
  verified: boolean;
  comment: string;
  isImage: boolean;
  fileName?: string;
  updated?: boolean;
  status?: "Pending" | "Returned" | "Verified" | string;
}

interface ApplicationMessage {
  id: string;
  role: "admin" | "applicant";
  createdAt: string;
  text: string;
  eventType?: "RESUBMISSION";
  attachments?: AttachedFileNote[];
}

interface AttachedFileNote {
  fileId: string;
  documentLabel?: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  adminRemark: string;
  fileStatus?: "FLAGGED" | "REJECTED" | "PENDING" | string;
}

interface UploadGroup {
  key: string;
  label: string;
  name?: string;
  url: string;
  type: string;
  isImage: boolean;
  verified?: boolean;
  adminRemark?: string;
}

interface ApplicationRecord {
  id: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhoneNumber: string;
  yearLevel: string;
  school: string;
  submittedAt: string;
  status: string;
  documents: DocumentItem[];
  uploadGroups?: UploadGroup[];
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
  };
  messages: ApplicationMessage[];
}

interface ApplicationMetricCardProps {
  label: string;
  value: number;
  subtitle: string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}

function ApplicationMetricCard({ label, value, subtitle, icon: Icon, active, onClick }: ApplicationMetricCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group relative w-full overflow-hidden bg-white rounded-2xl border p-4 shadow-sm flex flex-col gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${active ? "border-slate-900 ring-1 ring-inset ring-slate-900 shadow-md" : "border-slate-200/80 opacity-70 hover:opacity-100 transition-opacity cursor-pointer"}`}
    >
      <div aria-hidden="true" className="pointer-events-none absolute -top-10 -right-10 w-32 h-32 bg-cyan-50/50 rounded-full blur-2xl transition-colors duration-500 group-hover:bg-cyan-100/50" />
      <div className="relative z-10 flex items-center justify-between gap-3">
        <span className={`text-[10px] font-bold tracking-widest uppercase ${active ? "text-cyan-700" : "text-slate-400"}`}>{label}</span>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-110 ${active ? "bg-cyan-600 text-white" : "bg-cyan-50/70 border border-cyan-100 text-cyan-600"}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <div className="relative z-10">
        <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">
          {value}
        </h3>
        <p className={`text-[11px] font-medium mt-1 ${active ? "text-slate-500" : "text-slate-400"}`}>{subtitle}</p>
      </div>
    </button>
  );
}

function getDocumentReviewStatus(doc: DocumentItem, reviewThread: ApplicationMessage[]) {
  if (doc.verified) return "Verified";
  if (doc.status === "Returned") return "Returned";

  const flaggedAttachment = reviewThread
    .flatMap((message) => message.attachments ?? [])
    .find((attachment) => {
      const isTargetedDocument =
        attachment.fileId === doc.id ||
        attachment.fileUrl === doc.previewUrl ||
        attachment.fileUrl?.includes(doc.label) ||
        attachment.fileName === doc.label;

      return (
        isTargetedDocument &&
        /flagged|returned|rejected/i.test(attachment.fileStatus ?? attachment.adminRemark ?? "")
      );
    });

  if (flaggedAttachment) return "Returned";
  return "Pending";
}

function normalizeApplicationStatus(status: string) {
  const normalized = (status || "").trim().toLowerCase();
  if (/waitlist/.test(normalized)) return "Waitlisted";
  if (/resubm|resubmit|resubmitted/.test(normalized)) return "Resubmitted";
  if (/returned|correction|required|revise|revision/.test(normalized)) return "Returned";
  if (/approve|approved/.test(normalized)) return "Approved";
  if (/rejected/.test(normalized)) return "Rejected";
  if (/ineligible/.test(normalized)) return "Ineligible";
  if (/responded/.test(normalized)) return "Responded";
  return "Pending Review";
}

function formatDate(dateString: string) {
  try {
    return new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return dateString;
  }
}

function extractUrls(text: string) {
  const urlRegex = /https?:\/\/[\w\-./?=&%]+/g;
  return Array.from(text.match(urlRegex) || []);
}

function isUploadedFilesSystemMessage(text: string) {
  return /^Applicant uploaded files:\s*\n?/i.test((text || "").trim());
}

function isSubmissionSystemMessage(text: string) {
  if (!text) return false;
  const t = text.trim();
  // Detect messages like: "Applicant submitted a SKEAP application." or similar
  return /^Applicant submitted\b/i.test(t) || /Applicant submitted a SKEAP application/i.test(t);
}

function isImageUrl(url: string) {
  return /(\.jpg|\.jpeg|\.png|\.gif|\.webp|\.avif|\.svg)(\?|$)/i.test(url);
}

function isPdfUrl(url: string) {
  return /\.pdfm?(\?|$)/i.test(url);
}

function getDocumentFormat(doc: DocumentItem) {
  const extensionSource = `${doc.previewUrl} ${doc.label}`;
  if (
    isPdfUrl(doc.previewUrl) ||
    /\.pdfm?(?:\?|$|\s)/i.test(extensionSource) ||
    doc.type.toLowerCase().includes("pdf") ||
    doc.type.toLowerCase().includes("application/pdf")
  ) {
    return "PDF";
  }
  if (doc.isImage || doc.type.toLowerCase().includes("image") || doc.type.toLowerCase().startsWith("image/")) {
    return "Image";
  }
  return doc.type || "Document";
}

function getFileTypeFromUrl(url: string): "image" | "pdf" | "office" | "document" {
  if (isImageUrl(url)) return "image";
  if (isPdfUrl(url)) return "pdf";
  if (/\.(docx?|xlsx?|pptx?)(\?|$)/i.test(url)) return "office";
  return "document";
}

function normalizeUrlForMatch(url: string): string {
  const candidate = String(url || "").trim();
  try {
    const parsed = new URL(candidate);
    parsed.hash = "";
    parsed.search = "";
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    return parsed.toString().toLowerCase();
  } catch {
    return candidate.replace(/\/+$/, "").toLowerCase();
  }
}

function isPlaceholderUrl(url: string) {
  return /^(?:https?:\/\/)?(?:www\.)?example\.com(?:[\/\?#]|$)/i.test(String(url || "").trim());
}

function isValidPreviewUrl(url: string) {
  return typeof url === "string" && url.trim().length > 0 && !isPlaceholderUrl(url);
}

function extractFileNameFromUrl(url: string): string {
  try {
    const filename = url.split("/").pop() || "";
    const decoded = decodeURIComponent(filename);
    const cleaned = decoded.replace(/\+/g, " ").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
    return normalizeDocumentLabel(cleaned || "Document");
  } catch {
    return "Document";
  }
}

function normalizeDocumentLabel(raw: string): string {
  const label = (raw || "").trim();
  const keyword = label.toLowerCase();
  if (keyword.includes("barangay")) return "Barangay Clearance";
  if (keyword.includes("skeap") && keyword.includes("form")) return "SKEAP Form";
  if (keyword.includes("id") && keyword.includes("photo")) return "ID Photo";
  if (keyword.includes("passport")) return "Passport";
  if (keyword.includes("proof") && keyword.includes("address")) return "Proof of Address";
  if (keyword.includes("recommendation")) return "Recommendation Letter";
  const stripped = label.replace(/^[0-9]{8,}\s*[-_ ]?/, "").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return stripped || "Document";
}

function areDocumentLabelsEquivalent(a: string, b: string) {
  const normalize = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const normalizedA = normalize(a);
  const normalizedB = normalize(b);
  if (normalizedA === normalizedB) return true;
  if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) return true;
  if (/(barangay|residency|residence)/.test(normalizedA) && /(barangay|residency|residence)/.test(normalizedB)) return true;
  if (/(enrollment|certificate)/.test(normalizedA) && /(enrollment|certificate)/.test(normalizedB)) return true;
  if (/(grade|report|transcript)/.test(normalizedA) && /(grade|report|transcript)/.test(normalizedB)) return true;
  return false;
}

function findDocumentByReviewKey(application: ApplicationRecord, reviewKey: string): DocumentItem | undefined {
  if (reviewKey.startsWith("url-")) {
    const targetUrl = reviewKey.replace(/^url-/, "");
    const normalizedTargetUrl = normalizeUrlForMatch(targetUrl);
    const urlMatch = application.documents.find((doc) => normalizeUrlForMatch(doc.previewUrl) === normalizedTargetUrl);
    if (urlMatch) return urlMatch;

    const groupMatch = application.uploadGroups?.find((group) => normalizeUrlForMatch(group.url) === normalizedTargetUrl);
    if (groupMatch) {
      return {
        id: groupMatch.key,
        label: groupMatch.label,
        type: groupMatch.type,
        previewUrl: groupMatch.url,
        verified: groupMatch.verified ?? false,
        comment: "",
        isImage: groupMatch.isImage,
      };
    }

    return undefined;
  }

  const directMatch = application.documents.find((doc) => doc.id === reviewKey);
  if (directMatch) return directMatch;

  const group = application.uploadGroups?.find((upload) => upload.key === reviewKey);
  if (!group) return undefined;

  const normalizedGroupUrl = normalizeUrlForMatch(group.url);
  const urlMatch = application.documents.find((doc) => normalizeUrlForMatch(doc.previewUrl) === normalizedGroupUrl);
  if (urlMatch) return urlMatch;

  return {
    id: group.key,
    label: group.label,
    type: group.type,
    previewUrl: group.url,
    verified: group.verified ?? false,
    comment: "",
    isImage: group.isImage,
  };
}

function getDocumentInlineRemark(doc: DocumentItem, reviewThread: ApplicationMessage[]) {
  return (
    reviewThread
      .flatMap((message) => message.attachments ?? [])
      .filter((attachment) => attachment.fileId === doc.id)
      .map((attachment) => attachment.adminRemark)
      .filter(Boolean)
      .pop() ?? ""
  );
}

export default function SkeapApplicationsClient({
  applications: initialApplications,
  counts,
  hasNextPage: initialHasNextPage,
  initialCursor,
  initialAcademicYear,
  academicYears,
}: {
  applications: ApplicationRecord[];
  counts?: { pending: number; returned: number; resubmitted?: number; approved: number };
  hasNextPage: boolean;
  initialCursor: { id: string; createdAt: string } | null;
  initialAcademicYear: string;
  academicYears: string[];
}) {
  const router = useRouter();
  const [applications, setApplications] = useState<ApplicationRecord[]>(initialApplications);
  const [selectedAppId, setSelectedAppId] = useState<string>(initialApplications[0]?.id ?? "");
  const [viewFilter, setViewFilter] = useState<"pending" | "resubmitted" | "returned" | "approved">("pending");
  const [selectedAcademicYear, setSelectedAcademicYear] = useState(initialAcademicYear);
  const itemsPerPage = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"overview" | "documents" | "activity">("overview");
  const [cursor, setCursor] = useState(initialCursor);
  const [hasNextPage, setHasNextPage] = useState(initialHasNextPage);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const isFetchingNextPageRef = useRef(false);
  const isRefreshingRef = useRef(false);
  const [messageDraft, setMessageDraft] = useState("");
  const [attachedFileNotes, setAttachedFileNotes] = useState<AttachedFileNote[]>([]);
  const noteTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const activityMessagesContainerRef = useRef<HTMLDivElement | null>(null);
  const activityMessagesEndRef = useRef<HTMLDivElement | null>(null);
  const [showApprovePreview, setShowApprovePreview] = useState(false);
  const [approvalCapacityFull, setApprovalCapacityFull] = useState<boolean | null>(null);
  const [isLoadingApprovalPreview, setIsLoadingApprovalPreview] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [showApprovalWarning, setShowApprovalWarning] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnMessage, setReturnMessage] = useState("");
  const [isReturning, setIsReturning] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [activeReviewFile, setActiveReviewFile] = useState<string | null>(null);
  const [reviewModalNote, setReviewModalNote] = useState("");
  const [reviewModalError, setReviewModalError] = useState<string | null>(null);
  const [isSavingReviewNote, setIsSavingReviewNote] = useState(false);
  const [isSavingDocumentVerification, setIsSavingDocumentVerification] = useState(false);
  const [optimisticVerification, setOptimisticVerification] = useState<{
    applicationId: string;
    reviewFile: string;
    verified: boolean;
  } | null>(null);

  const displayedApplications = useMemo(
    () => applications.filter((app) => {
      const status = normalizeApplicationStatus(app.status);
      if (viewFilter === "pending") return status === "Pending Review";
      if (viewFilter === "resubmitted") return status === "Resubmitted";
      if (viewFilter === "returned") return status === "Returned";
      if (viewFilter === "approved") return status === "Approved";
      return true;
    }),
    [applications, viewFilter]
  );

  const totalPages = Math.ceil(displayedApplications.length / itemsPerPage);
  const visiblePage = Math.min(currentPage, Math.max(totalPages, 1));
  const paginatedApplications = useMemo(
    () => displayedApplications.slice(
      (visiblePage - 1) * itemsPerPage,
      visiblePage * itemsPerPage
    ),
    [displayedApplications, visiblePage, itemsPerPage]
  );

  const selectedApplication =
    paginatedApplications.find((app) => app.id === selectedAppId) ?? paginatedApplications[0] ?? null;
  const effectiveSelectedAppId = selectedApplication?.id ?? "";

  const selectedStatus = normalizeApplicationStatus(selectedApplication?.status ?? "");
  const isApproved = selectedStatus === "Approved";
  const isWaitlisted = selectedStatus === "Waitlisted";
  const isReviewFinalized = isApproved || isWaitlisted;
  const canReturnForEdits = !isReviewFinalized && selectedStatus !== "Returned" && selectedStatus !== "Rejected" && selectedStatus !== "Ineligible";

  const queueTitle =
    viewFilter === "pending"
      ? "Pending Review"
      : viewFilter === "resubmitted"
      ? "Resubmitted Applications"
      : viewFilter === "approved"
      ? "Approved Archive"
      : "Returned Applications";
  const activeFilterName =
    viewFilter === "pending"
      ? "Pending Review"
      : viewFilter === "resubmitted"
      ? "Resubmitted Applications"
      : viewFilter === "returned"
      ? "Returned Queue"
      : "Approved Archive";
  const isQueueEmpty = displayedApplications.length === 0 && !hasNextPage && !isRefreshing;

  function changeViewFilter(filter: typeof viewFilter) {
    setViewFilter(filter);
    setCurrentPage(1);

    if (filter !== "approved" && selectedAcademicYear !== initialAcademicYear) {
      setSelectedAcademicYear(initialAcademicYear);
      setApplications([]);
      setSelectedAppId("");
      setCursor(null);
      setHasNextPage(false);
      void handleRefresh(initialAcademicYear);
    }
  }

  const initialStatusMap = useMemo(
    () => new Map(initialApplications.map((app) => [app.id, normalizeApplicationStatus(app.status)])),
    [initialApplications]
  );

  const statusDelta = useMemo(() => {
    const delta = {
      pending: 0,
      returned: 0,
      resubmitted: 0,
      approved: 0,
    };

    const normalizedToKey = (status: string) => {
      const normalized = normalizeApplicationStatus(status);
      if (normalized === "Approved") return "approved" as const;
      if (normalized === "Resubmitted") return "resubmitted" as const;
      if (normalized === "Returned") return "returned" as const;
      return "pending" as const;
    };

    applications.forEach((application) => {
      const previous = initialStatusMap.get(application.id) ?? normalizeApplicationStatus(application.status);
      const current = normalizeApplicationStatus(application.status);
      if (previous === current) return;
      delta[normalizedToKey(current)] += 1;
      delta[normalizedToKey(previous)] -= 1;
    });

    return delta;
  }, [applications, initialStatusMap]);

  const stats = useMemo(() => {
    const derived = {
      pending: applications.filter((app) => normalizeApplicationStatus(app.status) === "Pending Review").length,
      returned: applications.filter((app) => normalizeApplicationStatus(app.status) === "Returned").length,
      resubmitted: applications.filter((app) => normalizeApplicationStatus(app.status) === "Resubmitted").length,
      approved: applications.filter((app) => normalizeApplicationStatus(app.status) === "Approved").length,
    };

    if (!counts) {
      return derived;
    }

    return {
      pending: counts.pending + statusDelta.pending,
      returned: counts.returned + statusDelta.returned,
      resubmitted: (counts.resubmitted ?? 0) + statusDelta.resubmitted,
      approved: counts.approved + statusDelta.approved,
    };
  }, [applications, counts, statusDelta]);

  const uploadGroups = useMemo(
    () => selectedApplication?.uploadGroups ?? [],
    [selectedApplication]
  );

  const applicationDetails = selectedApplication?.application;

  useEffect(() => {
    const applicationId = selectedApplication?.id;
    if (!applicationId) return;

    let isActive = true;
    const syncApplicantProfile = async () => {
      if (document.visibilityState !== "visible") return;

      try {
        const response = await fetch(
          `/api/admin/skeap-applications/${encodeURIComponent(applicationId)}`,
          { cache: "no-store" }
        );
        if (!response.ok) throw new Error("Failed to refresh applicant profile.");

        const result = await response.json() as {
          profile: Pick<ApplicationRecord, "applicantName" | "applicantEmail" | "applicantPhoneNumber" | "school" | "yearLevel">;
        };
        if (!isActive) return;

        setApplications((current) =>
          current.map((application) =>
            application.id === applicationId
              ? {
                  ...application,
                  ...result.profile,
                  application: application.application
                    ? {
                        ...application.application,
                        applicantName: result.profile.applicantName,
                        emailAddress: result.profile.applicantEmail,
                        contactNumber: result.profile.applicantPhoneNumber,
                      }
                    : application.application,
                }
              : application
          )
        );
      } catch (error) {
        console.error("Failed to sync current applicant profile:", error);
      }
    };

    const intervalId = window.setInterval(() => {
      void syncApplicantProfile();
    }, 30_000);
    window.addEventListener("focus", syncApplicantProfile);
    void syncApplicantProfile();

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", syncApplicantProfile);
    };
  }, [selectedApplication?.id]);

  const documentMapByUrl = useMemo(
    () =>
      new Map<string, DocumentItem>(
        (selectedApplication?.documents ?? []).map((doc) => [normalizeUrlForMatch(doc.previewUrl), doc])
      ),
    [selectedApplication]
  );

  const [showApplicationForm, setShowApplicationForm] = useState(false);

  const verifyUploadGroups = useMemo(
    () => uploadGroups.filter((group) => group.key !== SKEAP_UPLOAD_KEY.PHOTO && group.key !== SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE),
    [uploadGroups]
  );

  const visibleVerifyDocuments = useMemo<DocumentItem[]>(() => {
    if (verifyUploadGroups.length > 0) {
      const updatedUploadKeys = selectedStatus === "Resubmitted"
        ? getLatestSkeapResubmissionUploadKeys(selectedApplication?.messages ?? [])
        : new Set<string>();
      return CORE_UPLOAD_KEYS.map((key) => {
        const group = verifyUploadGroups.find((groupItem) => groupItem.key === key);
        const groupUrl = group?.url ?? "";
        const normalizedGroupUrl = normalizeUrlForMatch(groupUrl);
        const matchedDoc = selectedApplication?.documents.find((doc) => {
          const normalizedDocUrl = normalizeUrlForMatch(doc.previewUrl);
          return (
            normalizedDocUrl === normalizedGroupUrl ||
            doc.id === key ||
            areDocumentLabelsEquivalent(doc.label, SKEAP_UPLOAD_LABELS[key])
          );
        });

        return {
          id: key,
          label: SKEAP_UPLOAD_LABELS[key],
          type: group?.type ?? matchedDoc?.type ?? "Document",
          previewUrl: groupUrl || matchedDoc?.previewUrl || "",
          verified:
            group?.verified ??
            matchedDoc?.verified ??
            documentMapByUrl.get(normalizeUrlForMatch(groupUrl))?.verified ??
            false,
          comment:
            matchedDoc?.comment ?? documentMapByUrl.get(normalizeUrlForMatch(groupUrl))?.comment ?? "",
          isImage: group?.isImage ?? matchedDoc?.isImage ?? false,
          fileName: group?.name,
          updated: updatedUploadKeys.has(key),
        };
      });
    }
    if (!selectedApplication) return [];
    return CORE_UPLOAD_KEYS.map((key) => {
      const doc = selectedApplication.documents.find((item) => item.id === key || areDocumentLabelsEquivalent(item.label, SKEAP_UPLOAD_LABELS[key]));
      return {
        id: key,
        label: SKEAP_UPLOAD_LABELS[key],
        type: doc?.type ?? "Document",
        previewUrl: doc?.previewUrl ?? "",
        verified: doc?.verified ?? false,
        comment: doc?.comment ?? "",
        isImage: doc?.isImage ?? false,
      };
    });
  }, [verifyUploadGroups, selectedApplication, documentMapByUrl, selectedStatus]);

  const verifiedCount = useMemo(
    () => visibleVerifyDocuments.filter((doc) => doc.verified).length,
    [visibleVerifyDocuments]
  );

  const verifyDocumentCount = visibleVerifyDocuments.length;

  const isFullyVerified = useMemo(
    () => visibleVerifyDocuments.every((doc) => doc.verified) ?? false,
    [visibleVerifyDocuments]
  );

  const activeReviewDocument = useMemo(() => {
    if (!selectedApplication || !activeReviewFile) return undefined;
    return findDocumentByReviewKey(selectedApplication, activeReviewFile);
  }, [selectedApplication, activeReviewFile]);

  const activeReviewGroup = useMemo(
    () => selectedApplication?.uploadGroups?.find((group) => group.key === activeReviewFile || normalizeUrlForMatch(group.url) === normalizeUrlForMatch(activeReviewFile ?? "")),
    [selectedApplication, activeReviewFile]
  );

  const unresolvedPreviewUrl = activeReviewFile?.startsWith("url-") ? activeReviewFile.slice(4) : "";
  const activeReviewPreviewUrl = activeReviewDocument?.previewUrl || activeReviewGroup?.url || unresolvedPreviewUrl;
  const activeReviewLabel = activeReviewDocument?.label || activeReviewGroup?.label || (unresolvedPreviewUrl ? extractFileNameFromUrl(unresolvedPreviewUrl) : "Document preview");
  const activeReviewIsPdf =
    isPdfUrl(activeReviewPreviewUrl) ||
    activeReviewDocument?.type.toLowerCase().includes("pdf") === true ||
    activeReviewGroup?.type.toLowerCase().includes("pdf") === true;

  const persistedReviewVerified = activeReviewGroup?.verified ?? activeReviewDocument?.verified ?? false;
  const activeReviewVerified =
    optimisticVerification !== null &&
    optimisticVerification.applicationId === selectedApplication?.id &&
    optimisticVerification.reviewFile === activeReviewFile
      ? optimisticVerification.verified
      : persistedReviewVerified;
  const activityMessages = useMemo(
    () => [...(selectedApplication?.messages ?? [])].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    ),
    [selectedApplication?.messages]
  );

  useEffect(() => {
    if (activeTab !== "activity") return;
    const container = activityMessagesContainerRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [activeTab, selectedApplication?.id, activityMessages.length]);

  const handleRefresh = useCallback(async (
    academicYear = selectedAcademicYear,
    { refreshServerData = true, silent = false }: { refreshServerData?: boolean; silent?: boolean } = {}
  ) => {
    if (isRefreshingRef.current || isFetchingNextPageRef.current) return;

    isRefreshingRef.current = true;
    if (silent) {
      setIsPolling(true);
    } else {
      setIsRefreshing(true);
    }
    try {
      const params = new URLSearchParams({ academicYear });
      const response = await fetch(`/api/admin/skeap-applications?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to refresh applications.");

      const page = await response.json() as {
        applications: ApplicationRecord[];
        hasNextPage: boolean;
        nextCursor: { id: string; createdAt: string } | null;
      };

      if (silent) {
        setApplications((current) => {
          const refreshedIds = new Set(page.applications.map((application) => application.id));
          return [
            ...page.applications,
            ...current.filter((application) => !refreshedIds.has(application.id)),
          ];
        });
      } else {
        setApplications(page.applications);
        setCurrentPage(1);
        setSelectedAppId((currentId) =>
          page.applications.some((application) => application.id === currentId)
            ? currentId
            : page.applications[0]?.id ?? ""
        );
      }
      setCursor(page.nextCursor);
      setHasNextPage(page.hasNextPage);
      if (refreshServerData && academicYear === initialAcademicYear) router.refresh();
    } catch (error) {
      console.error(error);
    } finally {
      isRefreshingRef.current = false;
      if (silent) {
        setIsPolling(false);
      } else {
        setIsRefreshing(false);
      }
    }
  }, [initialAcademicYear, router, selectedAcademicYear]);

  useEffect(() => {
    const refreshSilently = () => {
      if (document.visibilityState === "visible") {
        void handleRefresh(selectedAcademicYear, { refreshServerData: false, silent: true });
      }
    };
    const intervalId = window.setInterval(refreshSilently, 15_000);
    document.addEventListener("visibilitychange", refreshSilently);
    window.addEventListener("focus", refreshSilently);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshSilently);
      window.removeEventListener("focus", refreshSilently);
    };
  }, [handleRefresh, selectedAcademicYear]);

  function handleAcademicYearChange(academicYear: string) {
    if (academicYear === selectedAcademicYear) return;

    setSelectedAcademicYear(academicYear);
    setApplications([]);
    setSelectedAppId("");
    setCursor(null);
    setHasNextPage(false);
    setCurrentPage(1);
    void handleRefresh(academicYear);
  }

  const fetchNextPage = useCallback(async () => {
    if (!hasNextPage || isFetchingNextPageRef.current || isRefreshingRef.current || !cursor) return;

    isFetchingNextPageRef.current = true;
    setIsFetchingNextPage(true);
    try {
      const params = new URLSearchParams({
        academicYear: selectedAcademicYear,
        cursorId: cursor.id,
        cursorDate: cursor.createdAt,
      });
      const response = await fetch(`/api/admin/skeap-applications?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load more applications.");

      const page = await response.json() as {
        applications: ApplicationRecord[];
        hasNextPage: boolean;
        nextCursor: { id: string; createdAt: string } | null;
      };

      setApplications((current) => {
        const existingIds = new Set(current.map((application) => application.id));
        return [...current, ...page.applications.filter((application) => !existingIds.has(application.id))];
      });
      setCursor(page.nextCursor);
      setHasNextPage(page.hasNextPage);
    } catch (error) {
      console.error(error);
    } finally {
      isFetchingNextPageRef.current = false;
      setIsFetchingNextPage(false);
    }
  }, [cursor, hasNextPage, selectedAcademicYear]);

  function updateSelectedApplication(
    updater: (application: ApplicationRecord) => ApplicationRecord
  ) {
    setApplications((current) =>
      current.map((application) =>
        application.id === selectedApplication?.id ? updater(application) : application
      )
    );
  }

  async function toggleDocumentVerified(documentId: string) {
    if (!selectedApplication || isReviewFinalized) return;
    const matchedDocument = findDocumentByReviewKey(selectedApplication, documentId);
    if (!matchedDocument) return;

    const uploadGroup = selectedApplication.uploadGroups?.find(
      (group) => group.key === documentId || normalizeUrlForMatch(group.url) === normalizeUrlForMatch(matchedDocument.previewUrl)
    );
    const documentKey = uploadGroup?.key ?? documentId;
    if (!SKEAP_UPLOAD_ORDER.includes(documentKey as (typeof SKEAP_UPLOAD_ORDER)[number])) return;

    const verified = !activeReviewVerified;
    const fileUrl = uploadGroup?.url ?? matchedDocument.previewUrl;
    const optimisticState = {
      applicationId: selectedApplication.id,
      reviewFile: documentId,
      verified,
    };
    setOptimisticVerification(optimisticState);
    setIsSavingDocumentVerification(true);
    setReviewModalError(null);
    try {
      const response = await fetch(`/api/admin/skeap-applications/${encodeURIComponent(selectedApplication.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentKey,
          fileUrl,
          verified,
        }),
      });
      const result = await response.json() as { verified?: unknown; error?: unknown };
      if (!response.ok || result.verified !== verified) {
        throw new Error(typeof result.error === "string" ? result.error : "Failed to update document verification.");
      }

      const normalizedUrl = normalizeUrlForMatch(fileUrl);
      updateSelectedApplication((application) => ({
        ...application,
        documents: application.documents.map((document) =>
          normalizeUrlForMatch(document.previewUrl) === normalizedUrl
            ? { ...document, verified }
            : document
        ),
        uploadGroups: application.uploadGroups?.map((group) =>
          group.key === documentKey
            ? { ...group, verified }
            : group
        ),
      }));
      setOptimisticVerification(null);
    } catch (error) {
      console.error("Failed to update document verification:", error);
      setOptimisticVerification(null);
      setReviewModalError(error instanceof Error ? error.message : "Failed to update document verification.");
    } finally {
      setIsSavingDocumentVerification(false);
    }
  }

  async function handleSaveAndCloseReviewNote() {
    const note = reviewModalNote.trim();
    if (!note || !selectedApplication || !activeReviewFile || isSavingReviewNote) return;

    const uploadGroup = selectedApplication.uploadGroups?.find(
      (group) =>
        group.key === activeReviewFile ||
        normalizeUrlForMatch(group.url) === normalizeUrlForMatch(activeReviewFile.startsWith("url-") ? activeReviewFile.slice(4) : findDocumentByReviewKey(selectedApplication, activeReviewFile)?.previewUrl ?? "")
    );
    if (!uploadGroup) {
      setReviewModalError("This document could not be matched to the application. Keep the note open and try again.");
      return;
    }

    setIsSavingReviewNote(true);
    setReviewModalError(null);
    try {
      const response = await fetch(`/api/admin/skeap-applications/${encodeURIComponent(selectedApplication.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentKey: uploadGroup.key,
          fileUrl: uploadGroup.url,
          adminRemark: note,
        }),
      });
      const result = await response.json() as { adminRemark?: unknown; error?: unknown };
      if (!response.ok || result.adminRemark !== note) {
        throw new Error(typeof result.error === "string" ? result.error : "Failed to save the private document remark.");
      }

      updateSelectedApplication((application) => ({
        ...application,
        uploadGroups: application.uploadGroups?.map((group) =>
          group.key === uploadGroup.key ? { ...group, adminRemark: note } : group
        ),
      }));
      setActiveReviewFile(null);
      setReviewModalNote("");
    } catch (error) {
      console.error(error);
      setReviewModalError(error instanceof Error ? error.message : "Failed to save the private document remark.");
    } finally {
      setIsSavingReviewNote(false);
    }
  }

  function openReturnModal() {
    const documentRemarks = (selectedApplication?.uploadGroups ?? [])
      .filter((group) => group.adminRemark?.trim())
      .map((group) => `- ${group.label}: ${group.adminRemark!.trim()}`);
    const compiledMessage = documentRemarks.length > 0
      ? `Please review and correct the following documents:\n\n${documentRemarks.join("\n")}`
      : "";

    setReturnError(null);
    setReturnMessage(compiledMessage);
    setShowReturnModal(true);
  }

  function openDocumentReview(reviewKey: string) {
    if (!selectedApplication) return;

    const document = findDocumentByReviewKey(selectedApplication, reviewKey);
    const targetUrl = reviewKey.startsWith("url-") ? reviewKey.slice(4) : document?.previewUrl;
    const uploadGroup = selectedApplication.uploadGroups?.find(
      (group) =>
        group.key === reviewKey ||
        normalizeUrlForMatch(group.url) === normalizeUrlForMatch(targetUrl ?? "")
    );

    setReviewModalNote(uploadGroup?.adminRemark ?? "");
    setReviewModalError(null);
    setActiveReviewFile(reviewKey);
  }

  async function saveReviewUpdate(action: "message" | "approve" | "return", text: string, attachments: AttachedFileNote[]) {
    if (!selectedApplication) return;

    const payload = {
      action,
      text,
      attachments: attachments.length > 0 ? attachments : undefined,
    } as const;

    const response = await fetch(`/api/inquiries/${selectedApplication.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.error || "Failed to send review update");
    }

    const body = await response.json();
    return {
      reviewThread: body.reviewThread as ApplicationMessage[] | undefined,
      reviewStatus: typeof body.reviewStatus === "string" ? body.reviewStatus : undefined,
      response: typeof body.response === "string" ? body.response : undefined,
    };
  }

  async function handleSendMessage() {
    if (isReviewFinalized) return;
    if (!messageDraft.trim() && attachedFileNotes.length === 0) return;
    if (!selectedApplication) return;

    try {
        const result = await saveReviewUpdate("message", messageDraft.trim(), attachedFileNotes);
      if (result?.reviewThread) {
        const reviewThread = result.reviewThread;
        const nextStatus = result.reviewStatus || selectedApplication.status;
        const flaggedFileIds = attachedFileNotes.map((attachment) => attachment.fileId);

        updateSelectedApplication((application) => {
          const applicantMessage =
            application.messages.find((message) => message.role === "applicant") ?? application.messages[0];
          return {
            ...application,
            status: nextStatus,
            documents: application.documents.map((doc) =>
              flaggedFileIds.includes(doc.id)
                ? { ...doc, status: "Returned" }
                : doc
            ),
            messages: applicantMessage ? [applicantMessage, ...reviewThread] : [...reviewThread],
          };
        });
      }
      setMessageDraft("");
      setAttachedFileNotes([]);
    } catch (error) {
      console.error(error);
    }
  }

  async function rejectApplication(reason: string) {
    if (!selectedApplication) throw new Error("No application selected");

    const response = await fetch(`/api/inquiries/${selectedApplication.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.error || "Failed to reject application");
    }

    return response.json();
  }

  async function handleConfirmReject() {
    if (!selectedApplication || isReviewFinalized || !rejectionReason.trim()) return;

    setIsRejecting(true);
    setRejectError(null);

    try {
      await rejectApplication(rejectionReason.trim());
      router.refresh();
      updateSelectedApplication((application) => ({
        ...application,
        status: "REJECTED",
        messages: [
          {
            id: `admin-reject-${Date.now()}`,
            role: "admin",
            createdAt: new Date().toISOString(),
            text: `Reason for rejection: ${rejectionReason.trim()}`,
          },
          ...application.messages,
        ],
      }));
      setSelectedAppId((currentSelectedId) => {
        const nextOpenApplication = displayedApplications.find((app) => app.id !== currentSelectedId);
        return nextOpenApplication?.id ?? currentSelectedId;
      });
      await handleRefresh(selectedAcademicYear, { refreshServerData: false });
      setShowRejectModal(false);
      setRejectionReason("");
    } catch (error) {
      setRejectError(error instanceof Error ? error.message : "Unable to reject application.");
      console.error(error);
    } finally {
      setIsRejecting(false);
    }
  }

  function handleApproveClick() {
    if (isReviewFinalized) return;
    if (!isFullyVerified) {
      setShowApprovalWarning(true);
      return;
    }
    setApprovalError(null);
    setApprovalCapacityFull(null);
    setIsLoadingApprovalPreview(true);
    void fetch("/api/programs/skeap-scholarship/status", { cache: "no-store" })
      .then(async (response) => {
        const result: unknown = await response.json();
        if (
          !response.ok ||
          typeof result !== "object" ||
          result === null ||
          !("remainingSlots" in result) ||
          typeof result.remainingSlots !== "number"
        ) {
          const errorMessage =
            typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
              ? result.error
              : "Unable to check SKEAP slot availability.";
          throw new Error(errorMessage);
        }
        setApprovalCapacityFull(result.remainingSlots <= 0);
        setShowApprovePreview(true);
      })
      .catch((error: unknown) => {
        setApprovalError(error instanceof Error ? error.message : "Unable to check SKEAP slot availability.");
      })
      .finally(() => setIsLoadingApprovalPreview(false));
  }

  async function handleApprove() {
    if (!selectedApplication || isReviewFinalized || isApproving) return;

    setIsApproving(true);
    setApprovalError(null);
    try {
      const approvalText = "Application reviewed for approval.";
      const result = await saveReviewUpdate("approve", approvalText, []);
      router.refresh();
      const reviewThread = result?.reviewThread;
      const resultingStatus = result?.reviewStatus ?? "Approved";
      if (reviewThread) {
        updateSelectedApplication((application) => ({
          ...application,
          status: resultingStatus,
          messages: [
            ...reviewThread,
          ],
        }));
      } else {
        updateSelectedApplication((application) => ({
          ...application,
          status: resultingStatus,
          messages: [
            {
              id: `msg-${Date.now()}`,
              role: "admin",
              createdAt: new Date().toISOString(),
              text: result?.response ?? approvalText,
            },
            ...application.messages,
          ],
        }));
      }

      await handleRefresh(selectedAcademicYear, { refreshServerData: false });
    } catch (error) {
      setApprovalError(error instanceof Error ? error.message : "Unable to approve application.");
      console.error(error);
    } finally {
      setIsApproving(false);
      setShowApprovePreview(false);
    }
  }

  async function handleConfirmReturn() {
    const corrections = returnMessage.trim();
    if (!selectedApplication || !corrections || isReturning) return;

    setIsReturning(true);
    setReturnError(null);
    try {
      const draftAttachments = (selectedApplication.uploadGroups ?? [])
        .filter((group) => group.adminRemark?.trim())
        .map((group): AttachedFileNote => ({
          fileId: group.key,
          fileName: group.label,
          fileUrl: group.url,
          fileType: group.type,
          adminRemark: group.adminRemark!.trim(),
        }));
      const result = await saveReviewUpdate("return", corrections, draftAttachments);
      if (result?.reviewThread) {
        updateSelectedApplication((application) => ({
          ...application,
          status: result.reviewStatus || "Returned",
          messages: result.reviewThread || application.messages,
        }));
      }
      setShowReturnModal(false);
      setReturnMessage("");
      router.refresh();
      await handleRefresh(selectedAcademicYear, { refreshServerData: false });
    } catch (error) {
      setReturnError(error instanceof Error ? error.message : "Unable to return application for edits.");
      console.error(error);
    } finally {
      setIsReturning(false);
    }
  }

  // Always render the workspace shell. The left column will show a local empty state
  // when there are no visible applications (pending or returned).

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1480px] gap-6 px-6">
        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 pb-20">
          <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">SKEAP Applications</span>
              <h1 className="mt-0.5 mb-1.5 text-2xl font-bold tracking-tight text-slate-900">Application review workspace</h1>
              <p className="max-w-2xl text-sm leading-relaxed text-slate-500">
                Select an application to inspect uploaded files, leave reviewer notes, and approve or return applicants.
              </p>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <ApplicationMetricCard
              label="Pending Review"
              value={stats.pending}
              subtitle="in queue"
              icon={Clock}
              active={viewFilter === "pending"}
              onClick={() => changeViewFilter("pending")}
            />
            <ApplicationMetricCard
              label="Resubmitted"
              value={stats.resubmitted}
              subtitle="updated files"
              icon={RefreshCcw}
              active={viewFilter === "resubmitted"}
              onClick={() => changeViewFilter("resubmitted")}
            />
            <ApplicationMetricCard
              label="Returned"
              value={stats.returned}
              subtitle="needs action"
              icon={CornerUpLeft}
              active={viewFilter === "returned"}
              onClick={() => changeViewFilter("returned")}
            />
            <ApplicationMetricCard
              label="Approved"
              value={stats.approved}
              subtitle="processed"
              icon={CheckCircle}
              active={viewFilter === "approved"}
              onClick={() => changeViewFilter("approved")}
            />
          </div>

          <section className="flex w-full items-stretch overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
            <aside className="flex h-full min-h-[500px] w-80 shrink-0 flex-col justify-between border-r border-slate-200 bg-slate-50 lg:w-96">
              <div className="sticky top-0 z-10 flex shrink-0 flex-col gap-3 border-b border-slate-200 bg-slate-50/90 p-5 backdrop-blur-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Applicant queue</p>
                    <h2 className="mt-3 text-2xl font-semibold text-slate-950">{queueTitle}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRefresh()}
                    disabled={isRefreshing || isPolling || isFetchingNextPage}
                    title="Refresh queue"
                    aria-label={isPolling ? "Checking for queue updates" : "Refresh queue"}
                    className="group shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:cursor-wait disabled:opacity-60"
                  >
                    <RefreshCw className={`h-4 w-4 transition-transform duration-500 group-hover:rotate-180 ${isRefreshing || isPolling ? "animate-spin" : ""}`} />
                  </button>
                </div>
                {viewFilter === "approved" ? (
                  <select
                    aria-label="Filter approved applications by academic year"
                    value={selectedAcademicYear}
                    onChange={(event) => handleAcademicYearChange(event.target.value)}
                    disabled={isRefreshing || isFetchingNextPage}
                    className="min-w-0 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm outline-none transition-all focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600 disabled:cursor-wait disabled:opacity-60"
                  >
                    {academicYears.map((academicYear) => (
                      <option key={academicYear} value={academicYear}>
                        A.Y. {academicYear}{academicYear === initialAcademicYear ? " (Current)" : ""}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>

              <div className="custom-scroll flex-1">
                <div className="flex flex-col gap-3 p-4">
                  {paginatedApplications.length === 0 && (hasNextPage || isRefreshing) && (
                    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                      {isFetchingNextPage || isRefreshing ? (
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                      ) : null}
                      <p className="text-sm font-semibold text-slate-500">
                        {isRefreshing
                          ? `Loading A.Y. ${selectedAcademicYear}...`
                          : isFetchingNextPage
                          ? `Loading ${activeFilterName.toLowerCase()}...`
                          : "No matching applications in the loaded results."}
                      </p>
                    </div>
                  )}

                  {paginatedApplications.map((application) => (
                    <button
                      key={application.id}
                      type="button"
                      onClick={() => setSelectedAppId(application.id)}
                      aria-pressed={application.id === effectiveSelectedAppId}
                      className={`group relative w-full overflow-hidden rounded-xl border px-5 py-4 text-left transition-all ${
                        application.id === effectiveSelectedAppId
                          ? "border-slate-200 bg-white text-slate-900 shadow-md"
                          : "border-transparent bg-transparent text-slate-900 hover:bg-slate-100"
                      }`}
                    >
                    {application.id === effectiveSelectedAppId && (
                        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-cyan-700" />
                      )}
                      <div className="pl-2">
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900">{application.applicantName}</p>
                            <p className="mt-1 truncate text-xs text-slate-500">
                              {normalizeSkeapSchoolName(application.school) || "No school provided"}
                              {application.school && application.yearLevel ? " • " : ""}
                              {application.yearLevel || ""}
                            </p>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${
                            normalizeApplicationStatus(application.status) === "Approved"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : normalizeApplicationStatus(application.status) === "Returned"
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : normalizeApplicationStatus(application.status) === "Resubmitted"
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : "border-slate-200 bg-slate-100 text-slate-600"
                          }`}>
                            {normalizeApplicationStatus(application.status) === "Returned"
                              ? "Returned"
                              : normalizeApplicationStatus(application.status) === "Resubmitted"
                              ? "Resubmitted"
                              : application.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-500">
                          <span>{formatDate(application.submittedAt)}</span>
                          <span>{application.documents.length} docs</span>
                        </div>
                      </div>
                    </button>
                  ))}

                  {isQueueEmpty && (
                    <div className="flex flex-col items-center px-3 py-10 text-center">
                      <FolderOpen className="mb-3 h-9 w-9 stroke-[1.5] text-slate-300" />
                      <p className="text-sm font-semibold text-slate-700">No applications in this queue</p>
                      <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">
                        There are no {activeFilterName.toLowerCase()} applications to review right now.
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleRefresh()}
                        disabled={isRefreshing || isPolling || isFetchingNextPage}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing || isPolling ? "animate-spin" : ""}`} />
                        {isRefreshing || isPolling ? "Checking..." : "Refresh queue"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="border-t border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(Math.max(1, visiblePage - 1))}
                    disabled={visiblePage === 1}
                    aria-label="Previous applicant page"
                    className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <span className="text-xs font-semibold text-slate-600">
                    Page {totalPages === 0 ? 0 : visiblePage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(Math.min(totalPages, visiblePage + 1))}
                    disabled={visiblePage >= totalPages}
                    aria-label="Next applicant page"
                    className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
                {hasNextPage && (
                  <button
                    type="button"
                    onClick={() => void fetchNextPage()}
                    disabled={isFetchingNextPage || isRefreshing}
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                  >
                    {isFetchingNextPage ? "Loading more applicants..." : "Load more applicants"}
                  </button>
                )}
              </div>
            </aside>

            <div className="custom-scroll relative flex min-w-0 flex-1 self-start flex-col items-stretch justify-start overflow-y-auto bg-slate-50/50">
              {selectedApplication ? (
                <div className="flex flex-col">
                  <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 pt-4 backdrop-blur-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Application details</p>
                        <h2 className="mt-2 text-2xl font-semibold text-slate-950">{selectedApplication.applicantName}</h2>
                        <p className="mt-1 text-sm text-slate-600">{selectedApplication.applicantEmail}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowApplicationForm(true)}
                        title="View compiled application form"
                        aria-label="View compiled application form"
                        className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-cyan-700 bg-cyan-700 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:border-cyan-800 hover:bg-cyan-800"
                      >
                        <span>View Form</span>
                      </button>
                    </div>
                    <div className="mt-3 mb-2 flex items-center gap-6 overflow-x-auto" role="tablist" aria-label="Application details sections">
                      {([
                        { id: "overview", label: "Overview" },
                        { id: "documents", label: "Documents & Files" },
                        { id: "activity", label: "Activity Log" },
                      ] as const).map((tab) => (
                        <button
                          key={tab.id}
                          id={`application-tab-${tab.id}`}
                          type="button"
                          role="tab"
                          aria-selected={activeTab === tab.id}
                          aria-controls={`application-panel-${tab.id}`}
                          onClick={() => setActiveTab(tab.id)}
                          className={`shrink-0 border-b-2 pb-2 text-sm font-bold transition-colors ${
                            activeTab === tab.id
                              ? "border-cyan-700 text-cyan-800"
                              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={`mx-auto flex min-h-[500px] w-full max-w-4xl flex-col px-4 md:px-6 ${
                    activeTab === "overview"
                        ? "justify-start pb-6 pt-6"
                      : activeTab === "documents"
                      ? "pt-5 pb-3"
                      : "flex-1 gap-4 pb-10 pt-4"
                  }`}>
                    {activeTab === "overview" && (
                      <div id="application-panel-overview" role="tabpanel" aria-labelledby="application-tab-overview" className="flex flex-col space-y-6">
                    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="border-b border-slate-100 px-5 py-4">
                        <h3 className="text-sm font-semibold text-slate-900">Applicant profile</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-px bg-slate-100 md:grid-cols-4">
                        <div className="flex min-w-0 flex-col gap-1.5 bg-white p-4 md:p-5">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</span>
                          <span className={`w-fit max-w-full truncate rounded-full border px-2.5 py-1 text-xs font-semibold ${
                            selectedStatus === "Returned"
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : selectedStatus === "Resubmitted"
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : selectedStatus === "Approved"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : selectedStatus === "Waitlisted"
                                ? "border-amber-200 bg-amber-50 text-amber-700"
                                : selectedStatus === "Rejected" || selectedStatus === "Ineligible"
                              ? "border-rose-200 bg-rose-50 text-rose-700"
                              : "border-slate-200 bg-slate-100 text-slate-700"
                          }`}>
                            {selectedStatus === "Returned" ? "Correction Required" : selectedStatus}
                          </span>
                        </div>
                        <div className="flex min-w-0 flex-col gap-1.5 bg-white p-4 md:p-5">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Submitted</span>
                          <span className="text-sm font-semibold text-slate-900">{formatDate(selectedApplication.submittedAt)}</span>
                        </div>
                        <div className="flex min-w-0 flex-col gap-1.5 bg-white p-4 md:p-5">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Verified docs</span>
                          <span className="text-sm font-semibold text-slate-900">{isReviewFinalized ? "5/5" : `${verifiedCount}/${verifyDocumentCount}`}</span>
                        </div>
                        <div className="flex min-w-0 flex-col gap-1.5 bg-white p-4 md:p-5">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Course / Year</span>
                          <span className="break-words text-sm font-semibold text-slate-900">
                            {[applicationDetails?.currentCourse, selectedApplication.yearLevel || applicationDetails?.yearLevel]
                              .filter(Boolean)
                              .join(" • ") || "Not provided"}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-px border-t border-slate-100 bg-slate-100 md:grid-cols-6">
                        <div className="flex min-w-0 flex-col gap-1.5 bg-white p-4 md:col-span-2 md:p-5">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Age</span>
                          <span className="text-sm font-semibold text-slate-900">
                            {applicationDetails?.age != null ? `${applicationDetails.age} yrs` : "Not provided"}
                          </span>
                        </div>
                        <div className="flex min-w-0 flex-col gap-1.5 bg-white p-4 md:col-span-4 md:p-5">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">School / Institution</span>
                          <span className="text-sm font-semibold leading-snug text-slate-900 break-words">{normalizeSkeapSchoolName(selectedApplication.school) || "Not provided"}</span>
                        </div>
                        <div className="flex min-w-0 flex-col gap-1.5 bg-white p-4 md:col-span-2 md:p-5">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Phone</span>
                          <span className="text-sm font-semibold text-slate-900 break-words">{selectedApplication.applicantPhoneNumber || "Not provided"}</span>
                        </div>
                        <div className="flex min-w-0 flex-col gap-1.5 bg-white p-4 md:col-span-4 md:p-5">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Email</span>
                          <span
                            className="text-sm font-semibold text-slate-900 break-all"
                            title={selectedApplication.applicantEmail}
                          >
                            {selectedApplication.applicantEmail}
                          </span>
                        </div>
                      </div>
                    </section>

                    {isApproved ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 shrink-0">
                            <CheckCircle className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <h4 className="text-sm font-bold text-slate-900">
                              Application Approved &amp; Onboarded
                            </h4>
                            <p className="text-sm leading-relaxed text-slate-600">
                              All mandatory documents have been verified. This applicant&apos;s review cycle is complete and they have been successfully provisioned as an active Grantee.
                            </p>
                            <div className="mt-2">
                              <Link
                                href="/admin/grantees"
                                className="group inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 transition-colors hover:text-emerald-900"
                              >
                                <span>View in Grantee Directory</span>
                                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : isWaitlisted ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 shrink-0">
                            <Clock className="h-5 w-5 text-amber-600" />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <h4 className="text-sm font-bold text-slate-900">Application Waitlisted</h4>
                            <p className="text-sm leading-relaxed text-slate-600">
                              All mandatory documents have been verified, but no active scholarship slots were available. This applicant is in the SKEAP waitlist and can be promoted when capacity opens.
                            </p>
                            <div className="mt-2">
                              <Link
                                href="/admin/skeap-waitlist"
                                className="group inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 transition-colors hover:text-amber-900"
                              >
                                <span>View Scholarship Waitlist</span>
                                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-8 flex flex-col gap-3 border-t border-slate-100 pt-6">
                        <button
                          type="button"
                          onClick={handleApproveClick}
                          disabled={isLoadingApprovalPreview}
                          className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-70"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {isLoadingApprovalPreview ? "Checking slot availability..." : "Approve Application"}
                        </button>
                        {approvalError ? <p role="alert" className="text-sm text-rose-600">{approvalError}</p> : null}
                        <div className={`grid gap-3 ${canReturnForEdits ? "grid-cols-2" : "grid-cols-1"}`}>
                          {canReturnForEdits ? (
                            <button
                              type="button"
                              onClick={() => {
                                openReturnModal();
                              }}
                              className="flex items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-bold text-amber-700 transition-colors hover:bg-amber-100"
                            >
                              <CornerUpLeft className="h-4 w-4" />
                              Return for Edits
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              setRejectError(null);
                              setShowRejectModal(true);
                            }}
                            className="flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2.5 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-50"
                          >
                            Reject Application
                          </button>
                        </div>
                      </div>
                    )}
                      </div>
                    )}

                    {activeTab === "documents" && (
                      <div id="application-panel-documents" role="tabpanel" aria-labelledby="application-tab-documents">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Files</p>
                          <h2 className="mt-1 text-xl font-semibold text-slate-950">Documents to verify</h2>
                        </div>
                        <div className="rounded-full bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-600">
                          {verifiedCount}/{verifyDocumentCount}
                        </div>
                      </div>

                      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                        <div className="divide-y divide-slate-200 bg-white">
                          {visibleVerifyDocuments.map((doc) => {
                            const docStatus = getDocumentReviewStatus(doc, selectedApplication?.messages ?? []);
                            const isResubmittedDoc = doc.updated || (selectedStatus === "Resubmitted" && docStatus === "Returned");
                            const badgeClass = isReviewFinalized || doc.verified
                              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                              : isResubmittedDoc
                              ? "bg-sky-50 text-sky-700 border border-sky-200"
                              : docStatus === "Returned"
                              ? "bg-red-50 text-red-600 border border-red-100"
                              : "bg-slate-100 text-slate-600 border border-slate-200";
                            const statusText = isReviewFinalized || doc.verified ? "Verified" : isResubmittedDoc ? "Pending" : docStatus;

                            return (
                              <div key={doc.id} className="w-full">
                                <div className={`flex items-center gap-3 px-4 py-3 transition ${isReviewFinalized ? "" : "hover:bg-slate-50"}`}>
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                                    {doc.isImage ? (
                                      <img
                                        key={doc.previewUrl}
                                        src={doc.previewUrl}
                                        alt={doc.label}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center bg-blue-50 text-blue-600">
                                        <FileText className="h-4 w-4" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex min-w-0 items-center gap-2">
                                      <p className="truncate text-sm font-semibold text-slate-900">{doc.label}</p>
                                      {doc.updated ? (
                                        <span className="shrink-0 rounded-full bg-cyan-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-cyan-700 ring-1 ring-inset ring-cyan-200">
                                          Updated
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className="truncate text-xs uppercase tracking-wider text-slate-500">
                                      {doc.updated && doc.fileName ? doc.fileName : getDocumentFormat(doc)}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => openDocumentReview(doc.id)}
                                      title="View document"
                                      aria-label={`View ${doc.label}`}
                                      className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-100 p-1.5 text-slate-600 transition hover:bg-slate-200"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </button>
                                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>
                                      {statusText}
                                    </span>
                                  </div>
                                </div>
                                {!isResubmittedDoc && docStatus === "Returned" ? (
                                  <div className="ml-20 rounded-r-lg border-l-2 border-red-400 bg-slate-50/70 p-2.5 text-xs text-slate-600">
                                    <div className="flex items-center gap-2 font-semibold text-red-600">
                                      <span className="inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
                                      Reviewer Note:
                                    </div>
                                    <p className="mt-1 leading-5">{getDocumentInlineRemark(doc, selectedApplication?.messages ?? [])}</p>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                      </div>
                    )}

                    {activeTab === "activity" && (
                      <div id="application-panel-activity" role="tabpanel" aria-labelledby="application-tab-activity" className="flex flex-col gap-4">
                    <div className={`flex h-[600px] max-h-[650px] min-h-[480px] flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm ${isReviewFinalized ? "pb-4" : ""}`}>
                      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 pb-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Conversation</p>
                          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Return notes & messages</h2>
                        </div>
                        <span className="rounded-full bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-600">
                          {selectedApplication?.messages?.length ?? 0} messages
                        </span>
                      </div>

                      <div ref={activityMessagesContainerRef} className="custom-scroll mt-4 min-h-0 flex-1 overflow-y-auto pl-4 pr-2">
                        <div className="relative space-y-8 border-l-2 border-slate-100 pl-6">
                        {activityMessages.map((message) => {
                          const urls = extractUrls(message.text);
                          const textWithoutUrls = urls.reduce((text, url) => text.replace(url, ""), message.text).trim();
                          const isUploadEvent = isUploadedFilesSystemMessage(message.text);
                          const isResubmissionEvent = message.eventType === "RESUBMISSION";
                          const isSubmissionEvent = isSubmissionSystemMessage(message.text);
                          const eventLabel = message.role === "admin"
                            ? "Reviewer Note"
                            : isResubmissionEvent
                            ? "Applicant Resubmission"
                            : isUploadEvent
                            ? "Applicant Resubmission"
                            : isSubmissionEvent
                            ? "Application Submitted"
                            : "Applicant Message";

                          return (
                            <article key={message.id} className="relative min-w-0">
                              <span
                                aria-hidden="true"
                                className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${message.role === "admin" ? "bg-cyan-600" : "bg-slate-300"}`}
                              />
                              <div className="mb-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                                <span className="text-xs font-bold text-slate-900">{eventLabel}</span>
                                <time className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                                  {formatActivityTimestamp(message.createdAt)}
                                </time>
                              </div>
                              {(textWithoutUrls && !isUploadEvent && !isSubmissionEvent) && (
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                                  {textWithoutUrls}
                                </div>
                              )}
                              {(urls.length > 0 || (message.attachments?.length ?? 0) > 0) && (
                                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                  {urls.map((url, urlIndex) => {
                                    const fileName = extractFileNameFromUrl(url);
                                    return (
                                      <button
                                        key={`${message.id}-url-${urlIndex}`}
                                        type="button"
                                        onClick={() => openDocumentReview(`url-${url}`)}
                                        title={`Preview ${fileName}`}
                                        aria-label={`Preview ${fileName}`}
                                        className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                                      >
                                        <Eye className="h-4 w-4 shrink-0 text-slate-400" />
                                        <span className="truncate">{fileName}</span>
                                      </button>
                                    );
                                  })}
                                  {message.attachments?.map((attachment, attachmentIndex) => (
                                    <button
                                      key={`${message.id}-${attachment.fileId}-${attachmentIndex}`}
                                      type="button"
                                      onClick={() => openDocumentReview(`url-${attachment.fileUrl}`)}
                                      title={`Preview ${attachment.documentLabel || attachment.fileName}`}
                                      aria-label={`Preview replaced document: ${attachment.documentLabel || attachment.fileName}`}
                                      className={`flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium transition ${
                                        isResubmissionEvent
                                          ? "border-cyan-200 bg-cyan-50/70 text-cyan-950 hover:bg-cyan-100/70"
                                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                      }`}
                                    >
                                      <Eye className="h-4 w-4 shrink-0 text-slate-400" />
                                      <span className="flex min-w-0 flex-1 flex-col">
                                        <span className="truncate">
                                          {attachment.documentLabel || attachment.fileName}
                                        </span>
                                        {isResubmissionEvent && attachment.documentLabel ? (
                                          <span className="truncate text-[10px] font-normal text-slate-500">
                                            {attachment.fileName}
                                          </span>
                                        ) : null}
                                      </span>
                                      {isResubmissionEvent ? (
                                        <span className="shrink-0 rounded-full bg-cyan-700 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                                          Replaced
                                        </span>
                                      ) : null}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </article>
                          );
                        })}
                          <div ref={activityMessagesEndRef} aria-hidden="true" />
                        </div>

                      {!isReviewFinalized && attachedFileNotes.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Attached file notes</p>
                          <div className="custom-scroll max-h-32 space-y-2 overflow-y-auto pr-1">
                            {attachedFileNotes.map((attachment, index) => (
                              <div
                                key={`${attachment.fileId}-${attachment.fileUrl ?? index}-${index}`}
                                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 transition hover:bg-slate-100"
                              >
                                <div className="flex h-8 w-8 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                                  {attachment.fileType?.toLowerCase().includes("image") || attachment.fileUrl?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                    <img
                                      src={attachment.fileUrl}
                                      alt={attachment.fileName}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-blue-50 text-blue-600">
                                      <FileText className="h-4 w-4" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-slate-900">{attachment.fileName}</p>
                                  <p className="truncate text-xs text-slate-600">{attachment.adminRemark}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAttachedFileNotes((prev) => prev.filter((_, i) => i !== index));
                                  }}
                                  className="shrink-0 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      </div>

                      {!isReviewFinalized && (
                        <div className="mt-4 shrink-0 border-t border-slate-100 pt-4">
                          <label htmlFor="reviewer-note" className="sr-only">Write a note to the applicant</label>
                          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-2 transition-all focus-within:border-slate-400 focus-within:bg-white">
                            <textarea
                              id="reviewer-note"
                              ref={noteTextareaRef}
                              value={messageDraft}
                              onChange={(event) => setMessageDraft(event.target.value)}
                              rows={2}
                              placeholder="Write a note to the applicant..."
                              className="w-full resize-none bg-transparent px-2 pt-1 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                            />
                            <div className="flex items-center justify-between px-2 pb-1">
                              <span className="text-xs text-slate-400">Use clear, actionable feedback</span>
                              <button
                                type="button"
                                onClick={handleSendMessage}
                                disabled={!messageDraft.trim() && attachedFileNotes.length === 0}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Send className="h-3.5 w-3.5" />
                                Send
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[500px] flex-col items-center justify-center p-8 text-center">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <FileText className="h-6 w-6" />
                  </div>
                  <h3 className="mb-1 text-lg font-semibold text-slate-800">No Application Selected</h3>
                  <p className="max-w-sm text-sm leading-relaxed text-slate-500">
                    Choose an application from the queue on the left to inspect uploaded files, review details, and take action.
                  </p>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>

      <SkeapApplicationFormModal
        isOpen={showApplicationForm}
        onClose={() => setShowApplicationForm(false)}
        application={selectedApplication?.application}
        downloadHref={`/api/applications/${selectedApplication?.id}/download`}
      />

      {activeReviewFile ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm sm:p-6">
            <div className="flex h-full max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-700">
                    {isApproved ? "Archived Document Preview" : isWaitlisted ? "Waitlisted Document Preview" : "Document Review"}
                  </p>
                  <h2 className="mt-1 text-lg font-black text-slate-900">{activeReviewLabel}</h2>
                </div>
                <div className="flex items-center gap-2">
                  {activeReviewPreviewUrl && isValidPreviewUrl(activeReviewPreviewUrl) ? (
                    <a
                      href={activeReviewPreviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open document in a new tab"
                      aria-label="Open document in a new tab"
                      className="rounded-lg bg-slate-50 p-2 text-slate-400 transition-colors hover:text-slate-600"
                    >
                      <ArrowUpRight className="h-5 w-5" />
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveReviewFile(null);
                      setReviewModalNote("");
                      setReviewModalError(null);
                    }}
                    disabled={isSavingReviewNote || isSavingDocumentVerification}
                    title="Close preview"
                    aria-label="Close document preview"
                    className="ml-1 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-100/60 sm:flex-row">
                <div className="flex min-h-0 min-w-0 flex-1 items-start justify-center overflow-auto p-4 sm:p-8">
                  <div className="w-full max-w-3xl shrink-0 overflow-hidden rounded-sm bg-white shadow-md ring-1 ring-slate-200">
                    {activeReviewIsPdf && isValidPreviewUrl(activeReviewPreviewUrl) ? (
                      <iframe
                        src={activeReviewPreviewUrl}
                        title="PDF preview"
                        className="h-[800px] w-full rounded-sm border-0 bg-white"
                      />
                    ) : activeReviewGroup?.isImage || activeReviewDocument?.isImage || isImageUrl(activeReviewPreviewUrl) ? (
                      <img
                        src={activeReviewPreviewUrl}
                        alt="Document preview"
                        className="h-auto w-full rounded-sm object-contain"
                      />
                    ) : activeReviewPreviewUrl && isValidPreviewUrl(activeReviewPreviewUrl) ? (
                      <div className="flex flex-col items-center justify-center gap-4 px-6 py-14 text-center text-slate-700">
                        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-600">
                          <FileText className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Click to open live preview wrapper</p>
                          <p className="mt-2 max-w-xl text-xs text-slate-500">
                            This document cannot be rendered natively in-browser. Use the Office viewer for a richer preview experience.
                          </p>
                        </div>
                        <a
                          href={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(activeReviewPreviewUrl)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                        >
                          <ArrowUpRight className="h-4 w-4" />
                          Open live preview
                        </a>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-4 px-6 py-14 text-center text-slate-700">
                        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-600">
                          <FileText className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Invalid preview URL</p>
                          <p className="mt-2 max-w-xl text-xs text-slate-500">
                            This document is not available for preview. Please confirm the uploaded file URL.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {!isReviewFinalized && (
                  <aside className="flex min-h-0 max-h-[48%] w-full shrink-0 flex-col overflow-hidden border-t border-slate-200 bg-white sm:max-h-none sm:w-80 sm:border-l sm:border-t-0 sm:shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)]">
                    <div className="shrink-0 space-y-3 border-b border-slate-100 p-5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Document status</h4>
                      <button
                        type="button"
                        onClick={() => {
                          if (activeReviewFile) void toggleDocumentVerified(activeReviewFile);
                        }}
                        disabled={isSavingReviewNote || isSavingDocumentVerification}
                        className={`flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl px-4 py-2.5 text-xs font-semibold tracking-wide text-white shadow-sm transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-70 ${
                          activeReviewVerified
                            ? "border border-slate-800 bg-slate-900 shadow-slate-900/10 hover:bg-slate-800 hover:shadow-md"
                            : "bg-teal-600 shadow-teal-600/20 hover:bg-teal-500 hover:shadow-md hover:shadow-teal-600/30"
                        }`}
                      >
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full ${
                          activeReviewVerified ? "bg-slate-800 text-slate-300" : "bg-teal-500 text-white"
                        }`}>
                          {activeReviewVerified ? (
                            <X className="h-3 w-3 stroke-[2.5]" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3 stroke-[2.5]" />
                          )}
                        </span>
                        <span>{activeReviewVerified ? "Mark as unverified" : "Mark as verified"}</span>
                      </button>
                      {reviewModalError ? (
                        <p role="alert" className="text-xs text-red-600">{reviewModalError}</p>
                      ) : null}
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col gap-2 p-5">
                      <label htmlFor="document-admin-remarks" className="shrink-0 text-sm font-bold text-slate-900">Admin remarks</label>
                      <p className="mb-1 shrink-0 text-[11px] text-slate-500">
                        Saved remarks stay private until you return the application.
                      </p>
                      <textarea
                        id="document-admin-remarks"
                        value={reviewModalNote}
                        onChange={(e) => {
                          setReviewModalNote(e.target.value);
                          setReviewModalError(null);
                        }}
                        disabled={isSavingReviewNote || isSavingDocumentVerification}
                        placeholder="e.g., Document is blurry, please re-upload..."
                        className="min-h-0 w-full flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#0F3D5C] focus:ring-2 focus:ring-[#0F3D5C]/20"
                      />
                    </div>
                    <div className="shrink-0 border-t border-slate-100 bg-slate-50 p-5">
                      <button
                        type="button"
                        onClick={handleSaveAndCloseReviewNote}
                        disabled={!reviewModalNote.trim() || isSavingReviewNote || isSavingDocumentVerification}
                        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSavingReviewNote ? "Saving..." : "Save Note & Close"}
                      </button>
                    </div>
                  </aside>
                )}
              </div>
            </div>
        </div>
      ) : null}

      {showReturnModal && selectedApplication && canReturnForEdits ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="return-application-title"
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
          >
            <header className="flex items-center justify-between border-b border-slate-100 p-5">
              <h3 id="return-application-title" className="text-base font-bold text-slate-900">
                Return Application
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowReturnModal(false);
                  setReturnMessage("");
                  setReturnError(null);
                }}
                disabled={isReturning}
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                aria-label="Close return application dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="space-y-4 p-5">
              <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
                <p className="text-xs leading-relaxed text-amber-800">
                  Returning the application changes its status to Returned and adds your correction instructions to the Activity Log.
                </p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="return-corrections" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Required Corrections <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="return-corrections"
                  value={returnMessage}
                  onChange={(event) => setReturnMessage(event.currentTarget.value)}
                  placeholder="Describe the corrections the applicant needs to make."
                  className="min-h-[120px] w-full resize-y rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  autoFocus
                  disabled={isReturning}
                  aria-invalid={Boolean(returnError)}
                  aria-describedby={returnError ? "return-corrections-error" : undefined}
                />
                {returnError ? (
                  <p id="return-corrections-error" role="alert" className="text-xs text-rose-600">
                    {returnError}
                  </p>
                ) : null}
              </div>
            </div>
            <footer className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 p-5">
              <button
                type="button"
                onClick={() => {
                  setShowReturnModal(false);
                  setReturnMessage("");
                  setReturnError(null);
                }}
                disabled={isReturning}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmReturn()}
                disabled={!returnMessage.trim() || isReturning}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isReturning ? "Returning..." : "Return Application"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {showRejectModal && !isReviewFinalized ? (
        <RejectApplicationModal
          applicantName={selectedApplication?.applicantName ?? "Applicant"}
          rejectionReason={rejectionReason}
          onReasonChange={setRejectionReason}
          onClose={() => {
            setShowRejectModal(false);
            setRejectionReason("");
            setRejectError(null);
          }}
          onConfirm={handleConfirmReject}
          submitting={isRejecting}
          error={rejectError}
        />
      ) : null}

      {showApprovalWarning && !isReviewFinalized ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.14)]">
            <div className="px-6 py-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Action blocked</p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-950">Approval temporarily disabled</h3>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Some documents are still pending verification. Review the current files and mark them <span className="font-semibold text-slate-950">Verified</span> before returning to approve the application.
              </p>
            </div>
            <div className="border-t border-slate-200 px-6 py-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowApprovalWarning(false);
                  setActiveTab("documents");
                }}
                className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Review files
              </button>
              <button
                type="button"
                onClick={() => setShowApprovalWarning(false)}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showApprovePreview && selectedApplication && !isReviewFinalized ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-emerald-500">Approval preview</p>
                <h2 className="mt-3 text-3xl font-bold text-slate-950">Approve this applicant</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowApprovePreview(false)}
                className="rounded-full border border-slate-200 bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-8 rounded-[1.5rem] border border-emerald-100 bg-emerald-50 p-6 text-slate-900">
              <div className="flex items-center gap-3 text-sm font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                {approvalCapacityFull ? "Waitlist Assignment Preview" : "Active Acceptance Preview"}
              </div>
              <p className="mt-4 leading-7">
                {approvalCapacityFull
                  ? `Dear ${selectedApplication.applicantName || "Applicant"}, your SKEAP application has been approved and routed to the scholarship waitlist. Promotion and capacity management will be handled there.`
                  : `Dear ${selectedApplication.applicantName || "Applicant"}, your SKEAP application has been successfully approved! You have been granted an active scholarship slot for Barangay Pico. Please check your portal for next steps.`}
              </p>
            </div>
            {approvalError ? <p role="alert" className="mt-4 text-sm text-rose-600">{approvalError}</p> : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowApprovePreview(false)}
                className="inline-flex items-center justify-center rounded-3xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={isApproving}
                className="inline-flex items-center justify-center gap-2 rounded-3xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition transform hover:bg-emerald-700 hover:shadow-md active:scale-95 active:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:cursor-wait disabled:opacity-70"
              >
                <ArrowUpRight className="h-4 w-4" />
                {isApproving ? "Confirming..." : "Confirm approval"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
