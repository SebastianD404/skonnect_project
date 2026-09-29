"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowRight, ArrowUpRight, CheckCircle, CheckCircle2, ChevronLeft, ChevronRight, Clock, CornerUpLeft, Eye, FileText, FolderOpen, RefreshCcw, RefreshCw, Send, X, type LucideIcon } from "lucide-react";
import RejectApplicationModal from "./RejectApplicationModal";
import SkeapApplicationFormModal from "@/components/SkeapApplicationFormModal";
import { CORE_UPLOAD_KEYS, SKEAP_UPLOAD_KEY, SKEAP_UPLOAD_LABELS } from "@/lib/skeap-upload";

interface DocumentItem {
  id: string;
  label: string;
  type: string;
  previewUrl: string;
  verified: boolean;
  comment: string;
  isImage: boolean;
  status?: "Pending" | "Returned" | "Verified" | string;
}

interface ApplicationMessage {
  id: string;
  role: "admin" | "applicant";
  createdAt: string;
  text: string;
  attachments?: AttachedFileNote[];
}

interface AttachedFileNote {
  fileId: string;
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
}

interface ApplicationRecord {
  id: string;
  applicantName: string;
  applicantEmail: string;
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
      className={`bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col w-full text-left transition hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${active ? "ring-2 ring-slate-900" : ""}`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600 border border-slate-100">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1">
        {label}
      </span>
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-black text-slate-900 leading-none tracking-tight">
          {value}
        </span>
        <span className="text-xs text-slate-500">{subtitle}</span>
      </div>
    </button>
  );
}

function getDocumentReviewStatus(doc: DocumentItem, reviewThread: ApplicationMessage[]) {
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
  if (doc.verified) return "Verified";
  return "Pending";
}

function normalizeApplicationStatus(status: string) {
  const normalized = (status || "").trim().toLowerCase();
  if (/resubm|resubmit|resubmitted/.test(normalized)) return "Resubmitted";
  if (/returned|correction|required|revise|revision/.test(normalized)) return "Returned";
  if (/approve|approved/.test(normalized)) return "Approved";
  if (/rejected/.test(normalized)) return "Rejected";
  if (/ineligible/.test(normalized)) return "Ineligible";
  if (/responded/.test(normalized)) return "Responded";
  return "Pending Review";
}

function statusFromReviewText(text: string) {
  const normalized = (text || "").trim();
  if (/resubm|resubmit|resubmitted/i.test(normalized)) return "Resubmitted";
  if (/returned|correction|required|revise|revision/i.test(normalized)) return "Returned";
  if (/approve|approved/i.test(normalized)) return "Approved";
  if (/rejected/i.test(normalized)) return "Rejected";
  if (/ineligible/i.test(normalized)) return "Ineligible";
  return null;
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

  const labelMatch = application.documents.find((doc) => {
    const lowerLabel = doc.label.toLowerCase();
    const lowerGroupLabel = group.label.toLowerCase();
    return (
      doc.id === group.key ||
      lowerLabel === lowerGroupLabel ||
      lowerLabel.includes(lowerGroupLabel) ||
      lowerGroupLabel.includes(lowerLabel)
    );
  });
  if (labelMatch) return labelMatch;

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
  const isFetchingNextPageRef = useRef(false);
  const isRefreshingRef = useRef(false);
  const [messageDraft, setMessageDraft] = useState("");
  const [attachedFileNotes, setAttachedFileNotes] = useState<AttachedFileNote[]>([]);
  const noteTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [showApprovePreview, setShowApprovePreview] = useState(false);
  const [showApprovalWarning, setShowApprovalWarning] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [activeReviewFile, setActiveReviewFile] = useState<string | null>(null);
  const [reviewModalNote, setReviewModalNote] = useState("");

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

  const selectedStatus = normalizeApplicationStatus(selectedApplication?.status ?? "");
  const isApproved = selectedStatus === "Approved";

  const queueTitle =
    viewFilter === "pending"
      ? "Pending Review"
      : viewFilter === "resubmitted"
      ? "Resubmitted Applications"
      : viewFilter === "approved"
      ? "Approved Archive"
      : "Returned / Correction Queue";
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

  const visibleVerifyDocuments = useMemo(() => {
    if (verifyUploadGroups.length > 0) {
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
          type: matchedDoc?.type ?? group?.type ?? "Document",
          previewUrl: matchedDoc?.previewUrl ?? groupUrl,
          verified:
            matchedDoc?.verified ??
            documentMapByUrl.get(normalizeUrlForMatch(groupUrl))?.verified ??
            group?.verified ??
            false,
          comment:
            matchedDoc?.comment ?? documentMapByUrl.get(normalizeUrlForMatch(groupUrl))?.comment ?? "",
          isImage: matchedDoc?.isImage ?? group?.isImage ?? false,
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
  }, [verifyUploadGroups, selectedApplication, documentMapByUrl]);

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

  const activeReviewVerified = activeReviewDocument?.verified ?? activeReviewGroup?.verified ?? false;

  const resolvedSelectedAppId = useMemo(
    () => (paginatedApplications.some((app) => app.id === selectedAppId) ? selectedAppId : paginatedApplications[0]?.id ?? ""),
    [paginatedApplications, selectedAppId]
  );

  const handleRefresh = useCallback(async (academicYear = selectedAcademicYear) => {
    if (isRefreshingRef.current || isFetchingNextPageRef.current) return;

    isRefreshingRef.current = true;
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams({ academicYear });
      const response = await fetch(`/api/admin/skeap-applications?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to refresh applications.");

      const page = await response.json() as {
        applications: ApplicationRecord[];
        hasNextPage: boolean;
        nextCursor: { id: string; createdAt: string } | null;
      };

      setApplications(page.applications);
      setCurrentPage(1);
      setSelectedAppId((currentId) =>
        page.applications.some((application) => application.id === currentId)
          ? currentId
          : page.applications[0]?.id ?? ""
      );
      setCursor(page.nextCursor);
      setHasNextPage(page.hasNextPage);
      if (academicYear === initialAcademicYear) router.refresh();
    } catch (error) {
      console.error(error);
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, [initialAcademicYear, router, selectedAcademicYear]);

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

  useEffect(() => {
    if (resolvedSelectedAppId !== selectedAppId) {
      setSelectedAppId(resolvedSelectedAppId);
    }
  }, [resolvedSelectedAppId, selectedAppId]);

  function updateSelectedApplication(
    updater: (application: ApplicationRecord) => ApplicationRecord
  ) {
    setApplications((current) =>
      current.map((application) =>
        application.id === selectedApplication?.id ? updater(application) : application
      )
    );
  }

  function toggleDocumentVerified(documentId: string) {
    if (!selectedApplication || isApproved) return;
    const matchedDocument = findDocumentByReviewKey(selectedApplication, documentId);
    if (!matchedDocument) return;

    const normalizedMatchedUrl = normalizeUrlForMatch(matchedDocument.previewUrl);
    const matchedDocumentId = matchedDocument.id;
    const matchedLabel = matchedDocument.label;

    const shouldMatch = (id: string, label: string, url: string) => {
      const normalizedUrl = normalizeUrlForMatch(url);
      const isUrlMatch = normalizedUrl && normalizedMatchedUrl && normalizedUrl === normalizedMatchedUrl;
      const isLabelMatch = areDocumentLabelsEquivalent(label, matchedLabel);
      const isIdMatch = id === matchedDocumentId || id === documentId;
      return isIdMatch || isUrlMatch || isLabelMatch;
    };

    updateSelectedApplication((application) => {
      const updatedDocuments = application.documents.map((document) =>
        shouldMatch(document.id, document.label, document.previewUrl)
          ? { ...document, verified: !document.verified }
          : document
      );

      const updatedUploadGroups = application.uploadGroups?.map((group) =>
        shouldMatch(group.key, group.label, group.url)
          ? { ...group, verified: !(group.verified ?? false) }
          : group
      );

      return {
        ...application,
        documents: updatedDocuments,
        uploadGroups: updatedUploadGroups,
      };
    });
  }

  async function saveReviewUpdate(action: "message" | "approve", text: string, attachments: AttachedFileNote[]) {
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
    };
  }

  async function handleSendMessage() {
    if (isApproved) return;
    if (!messageDraft.trim() && attachedFileNotes.length === 0) return;
    if (!selectedApplication) return;

    try {
        const result = await saveReviewUpdate("message", messageDraft.trim(), attachedFileNotes);
      if (result?.reviewThread) {
        const reviewThread = result.reviewThread;
        const nextStatus = result.reviewStatus || statusFromReviewText(messageDraft.trim()) || selectedApplication.status;
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
    if (!selectedApplication || isApproved || !rejectionReason.trim()) return;

    setIsRejecting(true);
    setRejectError(null);

    try {
      await rejectApplication(rejectionReason.trim());
      updateSelectedApplication((application) => ({
        ...application,
        status: "REJECTED",
        messages: [
          {
            id: `admin-reject-${Date.now()}`,
            role: "admin",
            createdAt: new Date().toISOString(),
            text: `Application rejected: ${rejectionReason.trim()}`,
          },
          ...application.messages,
        ],
      }));
      setSelectedAppId((currentSelectedId) => {
        const nextOpenApplication = displayedApplications.find((app) => app.id !== currentSelectedId);
        return nextOpenApplication?.id ?? currentSelectedId;
      });
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
    if (!isFullyVerified) {
      setShowApprovalWarning(true);
      return;
    }
    setShowApprovePreview(true);
  }

  async function handleApprove() {
    if (!selectedApplication || isApproved) return;

    try {
      const approvalText = "Application approved. The applicant has been routed to the scholarship waitlist for promotion and capacity management.";
      const result = await saveReviewUpdate("approve", approvalText, []);
      const reviewThread = result?.reviewThread;
      if (reviewThread) {
        updateSelectedApplication((application) => ({
          ...application,
          status: "Approved",
          messages: [
            ...reviewThread,
          ],
        }));
      } else {
        updateSelectedApplication((application) => ({
          ...application,
          status: "Approved",
          messages: [
            {
              id: `msg-${Date.now()}`,
              role: "admin",
              createdAt: new Date().toISOString(),
              text: approvalText,
            },
            ...application.messages,
          ],
        }));
      }
    } catch (error) {
      console.error(error);
    }
    setShowApprovePreview(false);
  }

  // Always render the workspace shell. The left column will show a local empty state
  // when there are no visible applications (pending or returned).

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1480px] gap-6 px-6 py-8">
        <main className="flex-1 space-y-6">
          <header className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <div>
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500">SKEAP Applications</p>
                <h1 className="mt-3 text-4xl font-black text-slate-950">Application review workspace</h1>
                <p className="mt-3 max-w-2xl text-sm text-slate-600">
                  Select an application to inspect uploaded files, leave reviewer notes, and approve or return applicants.
                </p>
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
              subtitle="updated apps"
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

          {isQueueEmpty ? (
            <section className="mt-6 flex min-h-[500px] w-full flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 shadow-sm">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              </div>
              <h2 className="mb-2 text-2xl font-black text-slate-900">No applications found</h2>
              <p className="mb-8 max-w-md text-sm leading-relaxed text-slate-500">
                There are no applications in the <span className="font-semibold text-slate-700">{activeFilterName}</span> queue.
              </p>
              <button
                type="button"
                onClick={() => void handleRefresh()}
                disabled={isRefreshing || isFetchingNextPage}
                className="group inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-500 group-hover:rotate-180 ${isRefreshing ? "animate-spin" : ""}`} />
                <span>{isRefreshing ? "Checking..." : "Check for new submissions"}</span>
              </button>
            </section>
          ) : (
          <section className="mt-6 flex h-[calc(100vh-280px)] min-h-[600px] w-full overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <aside className="flex h-full min-h-0 w-80 shrink-0 flex-col border-r border-slate-200 bg-slate-50 lg:w-96">
              <div className="sticky top-0 z-10 flex shrink-0 flex-col gap-3 border-b border-slate-200 bg-slate-50/90 p-5 backdrop-blur-sm">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Applicant queue</p>
                  <h2 className="mt-3 text-2xl font-semibold text-slate-950">{queueTitle}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    aria-label="Filter applications by academic year"
                    value={selectedAcademicYear}
                    onChange={(event) => handleAcademicYearChange(event.target.value)}
                    disabled={isRefreshing || isFetchingNextPage}
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm outline-none transition-all focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600 disabled:cursor-wait disabled:opacity-60"
                  >
                    {academicYears.map((academicYear) => (
                      <option key={academicYear} value={academicYear}>
                        A.Y. {academicYear}{academicYear === initialAcademicYear ? " (Current)" : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleRefresh()}
                    disabled={isRefreshing || isFetchingNextPage}
                    title="Refresh list"
                    aria-label="Refresh list"
                    className="group shrink-0 rounded-lg border border-slate-200 bg-white p-2 text-slate-400 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 disabled:cursor-wait disabled:opacity-60"
                  >
                    <RefreshCw className={`h-4 w-4 transition-transform duration-500 group-hover:rotate-180 ${isRefreshing ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              <div className="custom-scroll min-h-0 flex-1 overflow-y-auto">
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
                      aria-pressed={application.id === selectedAppId}
                      className={`group relative w-full overflow-hidden rounded-xl border px-5 py-4 text-left transition-all ${
                        application.id === selectedAppId
                          ? "border-slate-200 bg-white text-slate-900 shadow-md"
                          : "border-transparent bg-transparent text-slate-900 hover:bg-slate-100"
                      }`}
                    >
                      {application.id === selectedAppId && (
                        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-cyan-700" />
                      )}
                      <div className="pl-2">
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900">{application.applicantName}</p>
                            <p className="mt-1 truncate text-xs text-slate-500">
                              {application.school || "No school provided"}
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

                </div>
              </div>
              <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
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

            <div className="custom-scroll relative flex flex-1 flex-col items-stretch justify-start overflow-y-auto bg-slate-50/50">
              {selectedApplication ? (
                <div className="flex flex-1 flex-col">
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
                    <div className="mt-3 flex items-center gap-6 overflow-x-auto" role="tablist" aria-label="Application details sections">
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

                  <div className={`mx-auto flex min-h-0 w-full max-w-4xl flex-col px-4 md:px-6 ${
                    activeTab === "overview"
                      ? "flex-1 justify-center py-3"
                      : activeTab === "documents"
                      ? "pt-5 pb-3"
                      : "flex-1 gap-4 pb-10 pt-4"
                  }`}>
                    {activeTab === "overview" && (
                      <div id="application-panel-overview" role="tabpanel" aria-labelledby="application-tab-overview" className="flex flex-col gap-4">
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
                          <span className="text-sm font-semibold text-slate-900">{isApproved ? "5/5" : `${verifiedCount}/${verifyDocumentCount}`}</span>
                        </div>
                        <div className="flex min-w-0 flex-col gap-1.5 bg-white p-4 md:p-5">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Course / Year</span>
                          <span className="break-words text-sm font-semibold text-slate-900">
                            {[applicationDetails?.currentCourse, applicationDetails?.yearLevel || selectedApplication.yearLevel]
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
                          <span className="text-sm font-semibold leading-snug text-slate-900 break-words">{selectedApplication.school || "Not provided"}</span>
                        </div>
                        <div className="flex min-w-0 flex-col gap-1.5 bg-white p-4 md:col-span-2 md:p-5">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Phone</span>
                          <span className="text-sm font-semibold text-slate-900 break-words">{applicationDetails?.contactNumber || "Not provided"}</span>
                        </div>
                        <div className="flex min-w-0 flex-col gap-1.5 bg-white p-4 md:col-span-4 md:p-5">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Email</span>
                          <span
                            className="text-sm font-semibold text-slate-900 break-all"
                            title={applicationDetails?.emailAddress || selectedApplication.applicantEmail}
                          >
                            {applicationDetails?.emailAddress || selectedApplication.applicantEmail}
                          </span>
                        </div>
                      </div>
                    </section>

                    {isApproved ? (
                      <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
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
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={handleApproveClick}
                          className="flex w-full items-center justify-center gap-2 rounded-3xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Approve Application
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectError(null);
                            setShowRejectModal(true);
                          }}
                          className="flex w-full items-center justify-center rounded-lg border border-rose-200 bg-white px-4 py-2.5 text-xs font-bold text-rose-600 transition-all hover:bg-rose-50"
                        >
                          Reject Application
                        </button>
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
                            const isResubmittedDoc = selectedStatus === "Resubmitted" && docStatus === "Returned";
                            const badgeClass = isApproved
                              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                              : isResubmittedDoc
                              ? "bg-sky-50 text-sky-700 border border-sky-200"
                              : docStatus === "Returned"
                              ? "bg-red-50 text-red-600 border border-red-100"
                              : doc.verified
                              ? "bg-emerald-100 text-emerald-700 border border-emerald-100"
                              : "bg-slate-100 text-slate-600 border border-slate-200";
                            const statusText = isApproved ? "Verified" : isResubmittedDoc ? "Resubmitted" : docStatus;

                            return (
                              <div key={doc.id} className="w-full">
                                <div className={`flex items-center gap-3 px-4 py-3 transition ${isApproved ? "" : "hover:bg-slate-50"}`}>
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                                    {doc.isImage ? (
                                      <img
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
                                    <p className="truncate text-sm font-semibold text-slate-900">{doc.label}</p>
                                    <p className="truncate text-xs text-slate-500">{doc.type}</p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => setActiveReviewFile(doc.id)}
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
                    <div className={`rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm ${isApproved ? "pb-4" : ""}`}>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Conversation</p>
                          <h2 className="mt-3 text-2xl font-semibold text-slate-950">Return notes & messages</h2>
                        </div>
                        <span className="rounded-full bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-600">
                          {selectedApplication?.messages?.length ?? 0} messages
                        </span>
                      </div>

                      <div className="relative mt-4 space-y-8 border-l-2 border-slate-100 pl-6">
                        {(selectedApplication?.messages || []).map((message) => {
                          const urls = extractUrls(message.text);
                          const textWithoutUrls = urls.reduce((text, url) => text.replace(url, ""), message.text).trim();
                          const isUploadEvent = isUploadedFilesSystemMessage(message.text);
                          const isSubmissionEvent = isSubmissionSystemMessage(message.text);
                          const eventLabel = message.role === "admin"
                            ? "Reviewer Note"
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
                                  {formatDate(message.createdAt)}
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
                                        onClick={() => setActiveReviewFile(`url-${url}`)}
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
                                      onClick={() => setActiveReviewFile(`url-${attachment.fileUrl}`)}
                                      title={`Preview ${attachment.fileName}`}
                                      aria-label={`Preview ${attachment.fileName}`}
                                      className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                                    >
                                      <Eye className="h-4 w-4 shrink-0 text-slate-400" />
                                      <span className="truncate">{attachment.fileName}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </article>
                          );
                        })}
                      </div>

                      {!isApproved && attachedFileNotes.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Attached file notes</p>
                          <div className="space-y-2">
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

                      {!isApproved && (
                        <div className="mt-4">
                          <label className="block text-sm font-semibold text-slate-900">Write a note to the applicant</label>
                          <textarea
                            ref={noteTextareaRef}
                            value={messageDraft}
                            onChange={(event) => setMessageDraft(event.target.value)}
                            rows={4}
                            placeholder="Explain what is missing or how to improve the upload."
                            className="mt-3 w-full rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0F3D5C] focus:ring-2 focus:ring-[#0F3D5C]/20"
                          />
                          <button
                            type="button"
                            onClick={handleSendMessage}
                            disabled={!messageDraft.trim() && attachedFileNotes.length === 0}
                            className="mt-4 inline-flex items-center gap-2 rounded-3xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Send className="h-4 w-4" />
                            Send message
                          </button>
                        </div>
                      )}
                    </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[400px] flex-col items-center justify-center rounded-[2rem] border border-dashed border-slate-200 bg-white p-12 text-center">
                  <FolderOpen className="mb-3 h-12 w-12 stroke-[1.5] text-slate-300" />
                  <h3 className="mt-4 text-xl font-semibold text-slate-900">All caught up!</h3>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                    {viewFilter === "pending"
                      ? "All pending applications have been processed. Select a row on the left or browse another queue above."
                      : viewFilter === "resubmitted"
                      ? "There are no resubmitted applications awaiting review. Select another queue above to continue."
                      : viewFilter === "returned"
                      ? "There are no returned applications available. Select another queue above to continue."
                      : "Select a profile row from the archive list on the left to review its locked data history."}
                  </p>
                </div>
              )}
            </div>
          </section>
          )}
        </main>
      </div>

      <SkeapApplicationFormModal
        isOpen={showApplicationForm}
        onClose={() => setShowApplicationForm(false)}
        application={selectedApplication?.application}
        downloadHref={`/api/applications/${selectedApplication?.id}/download`}
      />

      {activeReviewFile ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          {activeReviewFile.startsWith("url-") && isImageUrl(activeReviewPreviewUrl) ? (
            <div className="w-full max-w-2xl rounded-[2rem] bg-white shadow-2xl">
              <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
                <p className="text-sm font-semibold text-slate-900">Image preview</p>
                <button
                  type="button"
                  onClick={() => setActiveReviewFile(null)}
                  className="rounded-full border border-slate-200 bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="overflow-hidden rounded-b-[2rem]">
                <img src={activeReviewFile.replace("url-", "")} alt="Preview" className="w-full h-auto max-h-96 object-contain" />
              </div>
            </div>
          ) : (
            <div className="flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-700">
                    {isApproved ? "Archived Document Preview" : "Document Review"}
                  </p>
                  <h2 className="mt-1 text-lg font-black text-slate-900">{activeReviewLabel}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveReviewFile(null);
                      setReviewModalNote("");
                    }}
                    title="Close preview"
                    aria-label="Close document preview"
                    className="ml-1 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className={`custom-scroll flex min-h-0 flex-1 flex-col ${isApproved ? "overflow-hidden" : "gap-5 overflow-y-auto p-5"}`}>
                <div className={`relative overflow-hidden ${isApproved ? "min-h-0 flex-1 bg-slate-100" : "h-[55vh] shrink-0 rounded-xl border border-slate-200 bg-slate-50"}`}>
                  {activeReviewGroup?.isImage || activeReviewDocument?.isImage || isImageUrl(activeReviewPreviewUrl) ? (
                    <img
                      src={activeReviewPreviewUrl}
                      alt="Document preview"
                      className={`w-full object-contain ${isApproved ? "h-full p-4" : "h-auto max-h-96"}`}
                    />
                  ) : isPdfUrl(activeReviewPreviewUrl) && isValidPreviewUrl(activeReviewPreviewUrl) ? (
                    <iframe
                      src={activeReviewPreviewUrl}
                      title="PDF preview"
                      className={`w-full border-0 bg-white ${isApproved ? "h-full" : "h-[55vh]"}`}
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

                {!isApproved && (
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-slate-900">Admin remarks</label>
                    <textarea
                      value={reviewModalNote}
                      onChange={(e) => setReviewModalNote(e.target.value)}
                      placeholder="Add notes about this document..."
                      rows={4}
                      className="w-full rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0F3D5C] focus:ring-2 focus:ring-[#0F3D5C]/20"
                    />
                  </div>
                )}

                {!isApproved && (
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        if (activeReviewFile) toggleDocumentVerified(activeReviewFile);
                      }}
                      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                        activeReviewVerified
                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {activeReviewVerified ? "Mark as unverified" : "Mark verified"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (reviewModalNote.trim() && selectedApplication && activeReviewFile) {
                          const doc = findDocumentByReviewKey(selectedApplication, activeReviewFile);
                          if (doc) {
                            const attachedNote: AttachedFileNote = {
                              fileId: doc.id,
                              fileName: doc.label,
                              fileUrl: doc.previewUrl,
                              fileType: doc.type,
                              adminRemark: reviewModalNote.trim(),
                            };
                            setAttachedFileNotes((prev) => [...prev, attachedNote]);
                            const prefix = activeReviewVerified ? "" : "[NEEDS REVISION] ";
                            const noteText = `• ${prefix}${doc.label}: ${reviewModalNote.trim()}`;
                            setMessageDraft((current) =>
                              current.trim()
                                ? `${current.trim()}\n${noteText}`
                                : noteText
                            );
                            setTimeout(() => {
                              noteTextareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                              noteTextareaRef.current?.focus();
                            }, 0);
                          }
                        }
                        setActiveReviewFile(null);
                        setReviewModalNote("");
                      }}
                      disabled={!reviewModalNote.trim()}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Save Note & Close
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {showRejectModal && !isApproved ? (
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

      {showApprovalWarning && !isApproved ? (
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
                  changeViewFilter(selectedStatus === "Resubmitted" ? "resubmitted" : "pending");
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

      {showApprovePreview && !isApproved ? (
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
                Acceptance message preview
              </div>
              <p className="mt-4 leading-7">
                Dear {selectedApplication.applicantName}, your SKEAP application has been approved and routed to the scholarship waitlist. Promotion and capacity management will be handled there.
              </p>
            </div>

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
                className="inline-flex items-center justify-center rounded-3xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition transform hover:bg-emerald-700 hover:shadow-md active:scale-95 active:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              >
                <ArrowUpRight className="h-4 w-4" />
                Confirm approval
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
