"use client";

import { useEffect, useState } from "react";
import FloatingFeedback from "@/app/components/FloatingFeedback";
import RevokeGranteeModal from "./RevokeGranteeModal";
import type { ReactNode } from "react";
import type { SubmissionStatus } from "@prisma/client";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileText,
  GraduationCap,
  Loader2,
  MapPin,
  Search,
  Undo2,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { normalizeSkeapSchoolName } from "@/lib/skeap-school";
import type { AcademicTermWindow } from "@/lib/academic-term-schedule";
import type { GradeReportDiagnostics } from "@/lib/grade-report-parser";
import { ADMIN_TABLE_PAGE_SIZES, DEFAULT_ADMIN_TABLE_PAGE_SIZE } from "@/lib/admin-pagination";
import AdminPaginationControls from "../AdminPaginationControls";

interface SubmissionRow {
  id: string;
  semester: string;
  gradeFileUrl: string;
  coeFileUrl: string;
  requiresStrictManualReview: boolean;
  ocrStatus: "OCR_PENDING" | "OCR_DONE" | "OCR_NEEDS_REVIEW" | "OCR_FAILED" | null;
  gradeDiagnostics: GradeReportDiagnostics | null;
  status: SubmissionStatus;
  coeStatus: SubmissionStatus;
  gradesStatus: SubmissionStatus;
  reviewNotes: string | null;
  flaggedFields?: string[];
  resubmittedFields?: string[];
  submittedAt: string;
  grantee: {
    id: string;
    user: { fullName: string; email: string };
    school: string;
    yearLevel: string;
  };
}

type TabType = "pending" | "returned" | "resubmitted" | "physical" | "cleared";
type DocumentReview = { status: "PENDING" | "APPROVED" | "RETURN_FOR_UPDATE"; notes: string };
type ReviewDraft = { coe: DocumentReview; grades: DocumentReview };

interface SubmissionsResponse {
  rows: SubmissionRow[];
  counts: Record<TabType, number>;
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  semesters: string[];
  academicTermWindow: AcademicTermWindow;
}

interface TabDef {
  id: TabType;
  label: string;
  description: string;
}

const EMPTY_REVIEW_DRAFT: ReviewDraft = {
  coe: { status: "PENDING", notes: "" },
  grades: { status: "PENDING", notes: "" },
};
const EMPTY_RESPONSE: SubmissionsResponse = {
  rows: [],
  counts: { pending: 0, returned: 0, resubmitted: 0, physical: 0, cleared: 0 },
  totalCount: 0,
  page: 1,
  pageSize: DEFAULT_ADMIN_TABLE_PAGE_SIZE,
  totalPages: 1,
  semesters: [],
  academicTermWindow: { status: "UNCONFIGURED", semester: null, opensAt: null, closesAt: null },
};

function formatWindowDate(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}
const TABS: TabDef[] = [
  { id: "pending", label: "Pending Review", description: "First-time digital submissions awaiting review" },
  { id: "returned", label: "Returned for Edits", description: "Submissions returned to grantees" },
  { id: "resubmitted", label: "Resubmitted", description: "Updated documents awaiting admin review" },
  { id: "physical", label: "For Physical CTC", description: "Digital files verified; original / CTC verification pending at the Barangay Hall" },
  { id: "cleared", label: "Fully Cleared", description: "Submissions approved by an administrator" },
];
const QUEUE_TITLES: Record<TabType, string> = {
  pending: "Review Queue",
  returned: "Returned Submissions",
  resubmitted: "Resubmitted Review Queue",
  physical: "For Physical CTC",
  cleared: "Cleared Records",
};
const EMPTY_QUEUE_COPY: Record<TabType, { title: string; description: string }> = {
  pending: {
    title: "No pending submissions",
    description: "First-time packages awaiting digital review will appear here.",
  },
  returned: {
    title: "No returned packages",
    description: "Packages awaiting grantee edits will appear here.",
  },
  resubmitted: {
    title: "No resubmitted packages",
    description: "Updated packages awaiting review will appear here.",
  },
  physical: {
    title: "No packages awaiting physical CTC",
    description: "Digitally verified packages awaiting in-person verification will appear here.",
  },
  cleared: {
    title: "No fully cleared packages",
    description: "Packages that passed digital screening and physical verification will appear here.",
  },
};

function getQueueSubtitle(tab: TabType, count: number) {
  const packages = count === 1 ? "package" : "packages";
  switch (tab) {
    case "pending":
      return `${count} ${packages} pending review`;
    case "returned":
      return `${count} ${packages} returned for edits`;
    case "resubmitted":
      return `${count} resubmitted ${packages}`;
    case "physical":
      return `${count} ${packages} awaiting physical CTC`;
    case "cleared":
      return `${count} ${packages} fully cleared`;
  }
}

function formatQueueName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en")
    .replace(/(^|[\s'-])(\p{L})/gu, (_match, separator: string, letter: string) =>
      `${separator}${letter.toLocaleUpperCase("en")}`
    );
}

function getQueueInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase("en"))
    .join("") || "?";
}

function formatQueueSemester(semester: string) {
  const yearRange = semester.match(/\b\d{4}\s*[-–]\s*\d{4}\b/)?.[0];
  if (!yearRange) return semester;

  const normalizedYearRange = yearRange.replace(/\s*[-–]\s*/, "–");
  const value = semester.toLocaleLowerCase("en");
  const term = /first|1st/.test(value)
    ? "1st Sem"
    : /second|2nd/.test(value)
      ? "2nd Sem"
      : /\bsummer\b/.test(value)
        ? "Summer"
        : semester.replace(yearRange, "").trim();

  return term ? `${normalizedYearRange} · ${term}` : normalizedYearRange;
}

const QUEUE_DATE_FORMAT = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  timeZone: "Asia/Manila",
});

function QueueDocumentBadge({
  label,
  status,
  isResubmitted,
  submissionStatus,
  hasPossibleFailingGrade = false,
}: {
  label: "COE" | "Grades";
  status: SubmissionStatus;
  isResubmitted: boolean;
  submissionStatus: SubmissionStatus;
  hasPossibleFailingGrade?: boolean;
}) {
  const isApproved = status === "APPROVED" || submissionStatus === "APPROVED";
  const isReturned = status === "RETURNED_FOR_EDIT" || status === "REJECTED";
  const state = isApproved ? "approved" : isReturned ? "returned" : isResubmitted ? "resubmitted" : "pending";
  const stateLabel = {
    approved: "approved",
    returned: "returned for edits",
    resubmitted: "resubmitted",
    pending: "pending review",
  }[state];
  const style = {
    approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
    returned: "border-amber-200 bg-amber-50 text-amber-700",
    resubmitted: "border-indigo-200 bg-indigo-50 text-indigo-700",
    pending: "border-slate-200 bg-slate-50 text-slate-600",
  }[state];

  return (
    <span
      title={`${label} ${stateLabel}${hasPossibleFailingGrade ? " · Possible failing grade detected" : ""}`}
      aria-label={`${label} ${stateLabel}${hasPossibleFailingGrade ? ", possible failing grade detected" : ""}`}
      className={`inline-flex h-[22px] items-center gap-1 rounded-full border px-1.5 text-[10px] font-semibold leading-none ${style}`}
    >
      {state === "approved" ? (
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
      ) : state === "pending" ? (
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" aria-hidden="true" />
      ) : (
        <Undo2 className="h-3 w-3" aria-hidden="true" />
      )}
      {label}
      {hasPossibleFailingGrade ? (
        <AlertTriangle className="h-3 w-3 text-amber-600" aria-hidden="true" />
      ) : null}
    </span>
  );
}

interface DocumentCardProps {
  submissionId: string;
  documentKind: "coe" | "grade";
  title: string;
  notesLabel: string;
  storedFilePath: string | null | undefined;
  badgeContent?: ReactNode;
  reviewNotesValue: string;
  onNotesChange: (value: string) => void;
  onApprove: () => void;
  onReturn: () => Promise<boolean>;
  disabled: boolean;
  approved: boolean;
  reviewLocked?: boolean;
}

function DocumentCard({
  submissionId,
  documentKind,
  title,
  notesLabel,
  storedFilePath,
  badgeContent,
  reviewNotesValue,
  onNotesChange,
  onApprove,
  onReturn,
  disabled,
  approved,
  reviewLocked = false,
}: DocumentCardProps) {
  const viewerUrl = `/api/submissions/${submissionId}/file?kind=${documentKind}`;
  const [previewType, setPreviewType] = useState<"pdf" | "image" | "unsupported" | "missing" | null>(null);
  const [rawStorageUrl, setRawStorageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!storedFilePath) return;

    const controller = new AbortController();
    fetch(`${viewerUrl}&metadata=true`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json();
        if (response.status === 404 && payload?.code === "FILE_NOT_FOUND") {
          setPreviewType("missing");
          return null;
        }
        if (!response.ok) throw new Error(payload?.error || "Could not inspect document type.");
        return payload as { contentType: string | null; extension: string; signedUrl?: string };
      })
      .then((metadata) => {
        if (!metadata) return;
        setRawStorageUrl(metadata.signedUrl ?? null);
        const { contentType, extension } = metadata;
        if (contentType === "application/pdf" || (!contentType && extension === "pdf")) {
          setPreviewType("pdf");
        } else if (
          (contentType && ["image/gif", "image/jpeg", "image/jfif", "image/png", "image/webp"].includes(contentType)) ||
          (!contentType && ["gif", "jpeg", "jpg", "jfif", "png", "webp"].includes(extension))
        ) {
          setPreviewType("image");
        } else {
          setPreviewType("unsupported");
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("Could not determine submission document preview type:", error);
        setPreviewType("unsupported");
      });

    return () => controller.abort();
  }, [storedFilePath, viewerUrl]);

  return (
    <article className="review-card flex h-full flex-col">
      <div className="review-card__header flex h-9 items-center justify-between mb-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 pr-2">
          {documentKind === "grade" ? (
            <GraduationCap className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
          ) : (
            <FileText className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
          )}
          <h3
            className="review-card__title min-w-0 flex-1"
            title={title}
          >
            {documentKind === "coe" && badgeContent ? "COE" : title}
          </h3>
        </div>
        {badgeContent ? <div className="shrink-0">{badgeContent}</div> : null}
      </div>

      <div className={`review-card__preview group relative h-44 w-full flex items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50 p-3 ${storedFilePath && previewType !== null && previewType !== "missing" ? "cursor-pointer" : ""}`}>
        {previewType === "pdf" ? (
          <iframe
            src={viewerUrl}
            title={`${title} preview`}
            className="h-full w-full max-h-full max-w-full border-0"
          />
        ) : previewType === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={viewerUrl}
            alt={title}
            className="max-h-full max-w-full object-contain"
          />
        ) : previewType === null && storedFilePath ? (
          <span className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Checking preview...
          </span>
        ) : (
          <div className="space-y-2 text-center">
            <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/60 bg-white text-slate-700 shadow-2xs">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-700">
                {previewType === "missing"
                  ? "Uploaded file not found"
                  : storedFilePath
                    ? "Preview not available"
                    : "No document uploaded"}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {previewType === "missing"
                  ? "The file is missing from storage. Re-upload the document before reviewing it."
                  : storedFilePath
                    ? "Open in a new tab to view or download."
                    : "This submission does not include this document."}
              </p>
            </div>
          </div>
        )}
        {storedFilePath && rawStorageUrl && previewType === "image" ? (
          <button
            type="button"
            onClick={() => window.open(rawStorageUrl, "_blank", "noopener,noreferrer")}
            aria-label={`View ${title} in a new tab`}
            className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/0 text-slate-900 transition-colors hover:bg-slate-900/10 focus-visible:bg-slate-900/10 focus-visible:outline focus-visible:outline-2 focus-visible:[outline-offset:-3px] focus-visible:outline-sky-500"
          >
            <span className="inline-flex translate-y-1 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-900 opacity-0 shadow-md transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              View
            </span>
          </button>
        ) : null}
      </div>

      <div className="review-card__notes flex min-h-0 flex-1 flex-col">
        {reviewLocked ? (
          <p className="review-card__actions text-xs font-semibold text-amber-800">
            Digital pre-check complete; awaiting physical Original / CTC verification.
          </p>
        ) : approved ? (
          reviewNotesValue.trim() ? (
            <>
              <label className="mt-4 mb-2 block text-sm font-semibold text-slate-800">{notesLabel}</label>
              <p className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {reviewNotesValue}
              </p>
            </>
          ) : null
        ) : (
          <>
            <label className="mt-4 mb-2 block text-sm font-semibold text-slate-800">{notesLabel}</label>
            <div className="flex flex-1 flex-col">
              <textarea
                rows={5}
                placeholder="Add feedback for the grantee..."
                value={reviewNotesValue}
                disabled={disabled}
                onChange={(event) => onNotesChange(event.target.value)}
                className="flex-1 w-full min-h-[140px] resize-none text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </>
        )}
      </div>

      {approved ? (
        <div className="review-card__actions review-card__actions--single">
          <button
            type="button"
            onClick={onReturn}
            disabled={disabled}
            className="review-button review-button--return"
          >
            <Undo2 className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            <span>Return / Undo</span>
          </button>
        </div>
      ) : documentKind === "grade" ? (
        <div className="review-card__actions">
          <button
            type="button"
            onClick={onReturn}
            disabled={disabled}
            className="review-button review-button--return"
          >
            <Undo2 className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            Return
          </button>
          <button
            type="button"
            onClick={onApprove}
            disabled={disabled}
            className="review-button review-button--approve"
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Approve Grades
          </button>
        </div>
      ) : (
        <div className="review-card__actions">
          <button
            type="button"
            onClick={onReturn}
            disabled={disabled}
            className="review-button review-button--return"
          >
            <Undo2 className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            <span>Return</span>
          </button>
          <button
            type="button"
            onClick={onApprove}
            disabled={disabled}
            className="review-button review-button--approve"
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{approved ? "Approved" : "Approve"}</span>
          </button>
        </div>
      )}

    </article>
  );
}

function SubmissionsSkeleton({ isMobileReviewOpen }: { isMobileReviewOpen: boolean }) {
  return (
    <div
      role="status"
      aria-label="Loading submission review"
      className="grid grid-cols-1 items-stretch gap-6 lg:h-[calc(100vh-220px)] lg:min-h-[600px] lg:grid-cols-12"
    >
      <div className={`${isMobileReviewOpen ? "hidden lg:flex" : "flex"} h-full min-h-[550px] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 pb-6 shadow-2xs sm:p-6 sm:pb-6 lg:col-span-4 lg:min-h-0`}>
        <div>
          <div className="mb-2 h-4 w-32 animate-pulse rounded bg-slate-200/80" />
          <div className="mb-6 h-3 w-20 animate-pulse rounded bg-slate-100" />
          <div className="space-y-3">
            {[0, 1].map((item) => (
              <div
                key={item}
                className="flex h-20 animate-pulse flex-col justify-between rounded-xl border border-slate-100 bg-slate-100/80 p-3"
              >
                <div className="flex items-center justify-between">
                  <div className={`h-3.5 rounded bg-slate-200/80 ${item === 0 ? "w-24" : "w-28"}`} />
                  <div className="h-4 w-16 rounded-full bg-slate-200/60" />
                </div>
                <div className={`h-3 rounded bg-slate-200/50 ${item === 0 ? "w-36" : "w-32"}`} />
              </div>
            ))}
          </div>
        </div>
        <div className="h-3 w-36 animate-pulse rounded bg-slate-100" />
      </div>

      <div className={`${isMobileReviewOpen ? "flex" : "hidden lg:flex"} h-full min-h-[320px] flex-col rounded-2xl border border-slate-200 bg-white p-5 pb-6 shadow-2xs sm:p-6 sm:pb-6 lg:col-span-8 lg:min-h-0`}>
        <div className="shrink-0 border-b border-slate-100 pb-3">
          <div className="mb-2 h-3 w-28 animate-pulse rounded bg-slate-200/60" />
          <div className="mb-2 h-6 w-40 animate-pulse rounded bg-slate-200/80" />
          <div className="h-3 w-72 max-w-full animate-pulse rounded bg-slate-100" />
        </div>

        <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2">
            {[0, 1].map((item) => (
              <div
                key={item}
                className="flex h-full min-h-0 flex-col rounded-xl border border-slate-100 bg-slate-50/50 p-4"
              >
                <div className="mb-3 flex h-9 items-center justify-between">
                  <div className={`h-3.5 animate-pulse rounded bg-slate-200/80 ${item === 0 ? "w-36" : "w-28"}`} />
                  {item === 1 ? <div className="h-4 w-20 animate-pulse rounded-full bg-slate-200/60" /> : null}
                </div>
                <div className="h-44 w-full shrink-0 animate-pulse rounded-lg bg-slate-200/50" />
                <div className="mt-4 flex min-h-0 flex-1 flex-col">
                  <div className="mb-2 h-4 w-36 shrink-0 animate-pulse rounded bg-slate-200/40" />
                  <div className="min-h-[140px] flex-1 animate-pulse rounded-lg bg-slate-200/40" />
                </div>
                <div className="flex shrink-0 gap-2">
                  <div className="h-8 flex-1 animate-pulse rounded-lg bg-slate-200/60" />
                  <div className="h-8 flex-1 animate-pulse rounded-lg bg-slate-200/60" />
                </div>
              </div>
            ))}
        </div>
      </div>
      <span className="sr-only">Loading submissions…</span>
    </div>
  );
}

export default function SubmissionReviewTable() {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("pending");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_ADMIN_TABLE_PAGE_SIZE);
  const [responseData, setResponseData] = useState<SubmissionsResponse>(EMPTY_RESPONSE);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [isMobileReviewOpen, setIsMobileReviewOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({});
  const [savingSubmissionId, setSavingSubmissionId] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  useEffect(() => {
    if (!actionSuccess) return;
    const timeout = window.setTimeout(() => setActionSuccess(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [actionSuccess]);

  useEffect(() => {
    const refreshSubmissions = () => {
      if (document.visibilityState === "visible") {
        setRefreshToken((current) => current + 1);
      }
    };
    const intervalId = window.setInterval(refreshSubmissions, 5000);
    document.addEventListener("visibilitychange", refreshSubmissions);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshSubmissions);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams({
        status: activeTab,
        page: String(page),
        limit: String(pageSize),
        search: query.trim(),
      });
      try {
        const result = await fetch(`/api/admin/submissions?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await result.json().catch(() => ({}));
        if (!result.ok) throw new Error(body?.error || "Unable to load submissions.");
        const nextResponse = body as SubmissionsResponse;
        setResponseData(nextResponse);
        setSelectedSubmissionId((current) =>
          current && nextResponse.rows.some((row) => row.id === current)
            ? current
            : nextResponse.rows[0]?.id ?? null
        );
        setLoadError(null);
        setPage(nextResponse.page ?? page);
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : "Unable to load submissions.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 200);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [activeTab, page, pageSize, query, refreshToken]);

  const selectedSubmission =
    responseData.rows.find((submission) => submission.id === selectedSubmissionId) ?? null;
  const canShowPrimaryRevoke =
    selectedSubmission !== null &&
    selectedSubmission.status !== "APPROVED" &&
    (selectedSubmission.status === "PENDING" ||
      selectedSubmission.status === "AWAITING_PHYSICAL_CTC" ||
      (selectedSubmission.flaggedFields?.length ?? 0) > 0);
  const gradeReportApproved =
    selectedSubmission?.gradesStatus === "APPROVED" || selectedSubmission?.status === "APPROVED";
  const canVerifyDigital =
    selectedSubmission?.status === "PENDING" &&
    selectedSubmission.coeStatus === "APPROVED" &&
    selectedSubmission.gradesStatus === "APPROVED" &&
    (selectedSubmission.flaggedFields?.length ?? 0) === 0;
  const draft = selectedSubmission
    ? reviewDrafts[selectedSubmission.id] ?? EMPTY_REVIEW_DRAFT
    : EMPTY_REVIEW_DRAFT;
  const isSaving = selectedSubmission !== null && savingSubmissionId === selectedSubmission.id;
  const activeTabRecordLabel = {
    pending: "pending review",
    returned: "returned for edits",
    resubmitted: "resubmitted",
    physical: "awaiting physical CTC",
    cleared: "fully cleared",
  }[activeTab];
  const emptyQueueCopy = query.trim()
    ? {
        title: "No matching submissions",
        description: "Try adjusting the grantee, school, or semester search.",
      }
    : EMPTY_QUEUE_COPY[activeTab];
  const pageRangeStart = responseData.totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageRangeEnd = Math.min(page * pageSize, responseData.totalCount);

  function changeTab(tab: TabType, selectedId: string | null = null) {
    setActiveTab(tab);
    setPage(1);
    setSelectedSubmissionId(selectedId);
    setIsMobileReviewOpen(false);
    setIsLoading(true);
  }

  function updateDraft(submissionId: string, updates: Partial<ReviewDraft>) {
    setReviewDrafts((current) => ({
      ...current,
      [submissionId]: {
        ...(current[submissionId] ?? EMPTY_REVIEW_DRAFT),
        ...updates,
      },
    }));
  }

  function removeGranteeFromQueue(granteeId: string) {
    const currentRows = responseData.rows;
    const granteeIndex = currentRows.findIndex((row) => row.grantee.id === granteeId);
    const remainingRows = currentRows.filter((row) => row.grantee.id !== granteeId);
    const hasGranteeInQueue = granteeIndex !== -1;
    const nextIndex = Math.min(granteeIndex, remainingRows.length - 1);
    const nextSubmission = hasGranteeInQueue ? remainingRows[nextIndex] ?? null : null;

    setResponseData((current) => ({
      ...current,
      rows: current.rows.filter((row) => row.grantee.id !== granteeId),
    }));
    if (hasGranteeInQueue) {
      setSelectedSubmissionId(nextSubmission?.id ?? null);
      setIsMobileReviewOpen((isOpen) => isOpen && nextSubmission !== null);
    }
    setIsRevokeModalOpen(false);

    if (hasGranteeInQueue && remainingRows.length === 0 && page > 1) {
      setPage((current) => Math.max(1, current - 1));
    } else {
      setRefreshToken((current) => current + 1);
    }
  }

  function handleActionError(error: unknown, fallback: string, granteeId: string) {
    const message = error instanceof Error ? error.message : fallback;
    if (message === "This grantee has already been revoked.") {
      removeGranteeFromQueue(granteeId);
    }
    setActionError(message);
  }

  async function postDocumentReview(
    submission: SubmissionRow,
    docType: "coe" | "grades",
    action: "APPROVE" | "RETURN_FOR_UPDATE",
    notes: string,
  ) {
    const response = await fetch(`/api/admin/submissions/${submission.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentType: docType,
        action,
        reviewNotes: notes,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || `Unable to review ${docType === "coe" ? "Certificate of Enrollment" : "Grade Report"}.`);
    }
  }

  async function submitDocumentReview(
    submission: SubmissionRow,
    docType: "coe" | "grades",
    action: "APPROVE" | "RETURN_FOR_UPDATE",
    reviewNotesOverride?: string,
  ): Promise<boolean> {
    const documentDraft = docType === "coe" ? draft.coe : draft.grades;
    const reviewNotes = reviewNotesOverride ?? documentDraft.notes;
    if (action === "RETURN_FOR_UPDATE" && !reviewNotes.trim()) {
      setValidationError("Add review notes before returning a document for edits.");
      return false;
    }

    setSavingSubmissionId(submission.id);
    setActionError(null);
    setValidationError(null);
    setActionSuccess(null);
    try {
      await postDocumentReview(submission, docType, action, reviewNotes.trim());
      updateDraft(submission.id, { [docType]: { status: "PENDING", notes: "" } });
      setActionSuccess(
        action === "APPROVE"
          ? `${docType === "coe" ? "Certificate of Enrollment" : "Grade Report"} approved.`
          : `${docType === "coe" ? "Certificate of Enrollment" : "Grade Report"} returned for edits.`
      );
      if (action === "RETURN_FOR_UPDATE") {
        changeTab("returned");
      } else {
        setIsLoading(true);
        setRefreshToken((current) => current + 1);
      }
      return true;
    } catch (error) {
      handleActionError(error, "Unable to process review action.", submission.grantee.id);
      return false;
    } finally {
      setSavingSubmissionId(null);
    }
  }

  async function confirmPhysicalCtc() {
    if (!selectedSubmission || isSaving) return;

    setSavingSubmissionId(selectedSubmission.id);
    setActionError(null);
    setValidationError(null);
    setActionSuccess(null);
    try {
      await postSubmissionAction(selectedSubmission, "CONFIRM_PHYSICAL_CTC");
      setActionSuccess("Physical Original / CTC verified. Submission fully cleared.");
      changeTab("cleared", selectedSubmission.id);
    } catch (error) {
      handleActionError(error, "Unable to confirm physical documents.", selectedSubmission.grantee.id);
      if (!(error instanceof Error && error.message === "This grantee has already been revoked.")) {
        setIsLoading(true);
        setRefreshToken((current) => current + 1);
      }
    } finally {
      setSavingSubmissionId(null);
    }
  }

  function returnDocumentForUpdate(
    submission: SubmissionRow,
    docType: "coe" | "grades",
  ): Promise<boolean> {
    const documentStatus = docType === "coe" ? submission.coeStatus : submission.gradesStatus;
    const isApproved = documentStatus === "APPROVED" || submission.status === "APPROVED";
    if (!isApproved) {
      return submitDocumentReview(submission, docType, "RETURN_FOR_UPDATE");
    }

    const savedNotes = reviewDrafts[submission.id]?.[docType].notes || submission.reviewNotes || "";
    const notes = window.prompt(
      "Add review notes before returning this approved document for edits:",
      savedNotes,
    );
    if (notes === null) return Promise.resolve(false);
    return submitDocumentReview(submission, docType, "RETURN_FOR_UPDATE", notes);
  }

  async function postSubmissionAction(
    submission: SubmissionRow,
    action: "VERIFY_DIGITAL" | "CONFIRM_PHYSICAL_CTC",
  ) {
    const response = await fetch(`/api/admin/submissions/${submission.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || "Unable to update submission verification status.");
    }
  }

  async function verifyDigitalAndRequestPhysicalCtc() {
    if (!selectedSubmission || isSaving) return;
    if (!canVerifyDigital) {
      setValidationError("Approve both digital documents and clear all correction flags before requesting physical verification.");
      return;
    }

    setSavingSubmissionId(selectedSubmission.id);
    setActionError(null);
    setValidationError(null);
    setActionSuccess(null);
    try {
      await postSubmissionAction(selectedSubmission, "VERIFY_DIGITAL");
      setActionSuccess("Digital pre-check complete. The grantee has been asked to submit the Original / CTC.");
      changeTab("physical", selectedSubmission.id);
    } catch (error) {
      handleActionError(error, "Unable to process submission review.", selectedSubmission.grantee.id);
      if (!(error instanceof Error && error.message === "This grantee has already been revoked.")) {
        setIsLoading(true);
        setRefreshToken((current) => current + 1);
      }
    } finally {
      setSavingSubmissionId(null);
    }
  }

  async function revokeSelectedGrantee(
    granteeId: string,
    reason: string,
    additionalNotes: string,
    isPermanentlyDisqualified: boolean,
  ) {
    if (!selectedSubmission || selectedSubmission.grantee.id !== granteeId || isSaving || !reason) return;

    setSavingSubmissionId(selectedSubmission.id);
    setActionError(null);
    setValidationError(null);
    setActionSuccess(null);
    try {
      const response = await fetch(`/api/admin/submissions/${selectedSubmission.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REVOKE", reason, additionalNotes, isPermanentlyDisqualified }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (payload?.revocationSaved === true) {
          removeGranteeFromQueue(granteeId);
          setActionError(payload?.error || "Grantee revoked, but waitlist offers could not be dispatched.");
          return;
        }
        throw new Error(payload?.error || "Unable to revoke grantee.");
      }

      removeGranteeFromQueue(granteeId);
    } catch (error) {
      handleActionError(error, "Unable to revoke grantee.", granteeId);
    } finally {
      setSavingSubmissionId(null);
    }
  }

  return (
    <section className="w-full">
      <div className="p-4 sm:p-5">
        <div className="flex w-full flex-wrap items-center gap-3">
          <label className="relative block w-full min-w-0 sm:w-72 sm:flex-none lg:w-[28rem]">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search grantee, school or semester..."
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
                setSelectedSubmissionId(null);
                setIsMobileReviewOpen(false);
                setIsLoading(true);
              }}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#0a1f33] focus:ring-2 focus:ring-[#0a1f33]/10"
            />
          </label>

          <label className="relative block w-full sm:hidden">
            <span className="sr-only">Filter submissions by status</span>
            <select
              value={activeTab}
              onChange={(event) => changeTab(event.target.value as TabType)}
              className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-10 text-xs font-semibold text-slate-700 outline-none focus:border-[#0a1f33] focus:ring-2 focus:ring-[#0a1f33]/10"
            >
              {TABS.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label} ({responseData.counts[tab.id]})
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden="true"
              className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            />
          </label>

          <div className="hidden max-w-full items-center gap-1.5 overflow-x-auto rounded-xl bg-slate-100 p-1 sm:ml-auto sm:flex">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => changeTab(tab.id)}
                aria-pressed={activeTab === tab.id}
                className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  activeTab === tab.id
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title={tab.description}
              >
                {tab.label}
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${activeTab === tab.id ? "bg-white/15" : "bg-slate-100"}`}>
                  {responseData.counts[tab.id]}
                </span>
              </button>
            ))}
          </div>

        </div>
        <div className="mt-3 flex justify-start lg:justify-end">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${
                responseData.academicTermWindow.status === "OPEN"
                  ? "bg-emerald-500"
                  : responseData.academicTermWindow.status === "UPCOMING"
                    ? "bg-sky-500"
                    : "bg-slate-400"
              }`}
            />
            {responseData.academicTermWindow.status === "OPEN"
              ? `${responseData.academicTermWindow.semester} documents open until ${formatWindowDate(responseData.academicTermWindow.closesAt)}`
              : responseData.academicTermWindow.status === "UPCOMING"
                ? `${responseData.academicTermWindow.semester} documents open ${formatWindowDate(responseData.academicTermWindow.opensAt)}`
                : responseData.academicTermWindow.status === "CLOSED"
                  ? `Latest document window closed: ${responseData.academicTermWindow.semester}`
                  : "Academic document schedule not configured"}
          </p>
        </div>
      </div>

      <div className="space-y-3 p-4 sm:p-5" aria-busy={isLoading}>
        {loadError ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</div> : null}
        {validationError ? (
          <FloatingFeedback message={validationError} type="error" onDismiss={() => setValidationError(null)} />
        ) : null}
        {actionError ? <FloatingFeedback message={actionError} type="error" autoDismissMs={5000} onDismiss={() => setActionError(null)} /> : null}
        {actionSuccess ? <FloatingFeedback message={actionSuccess} type="success" autoDismissMs={0} onDismiss={() => setActionSuccess(null)} /> : null}

        {isLoading ? <SubmissionsSkeleton isMobileReviewOpen={isMobileReviewOpen} /> : (
        <div className="grid grid-cols-1 items-stretch gap-6 lg:h-[calc(100vh-220px)] lg:min-h-[600px] lg:grid-cols-12">
          <aside className={`${isMobileReviewOpen ? "hidden lg:flex" : "flex"} min-h-[550px] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs lg:col-span-4 lg:h-full lg:min-h-0`}>
            <div className="flex shrink-0 items-center gap-2.5 bg-slate-900 px-5 py-4 text-white">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-200 shadow-inner">
                <FileText className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xs font-bold tracking-wide text-white">{QUEUE_TITLES[activeTab]}</h2>
                <p className="text-[10px] font-medium tracking-wider text-slate-400">
                  {getQueueSubtitle(activeTab, responseData.totalCount)}
                </p>
                </div>
            </div>

            <div className="custom-scroll custom-scroll-visible min-h-0 flex-1 overflow-y-scroll p-2.5">
              <div className="space-y-2">
              {responseData.rows.length === 0 ? (
                <div className="px-3 py-12 text-center">
                  <FileText className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-700">{emptyQueueCopy.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{emptyQueueCopy.description}</p>
                </div>
              ) : responseData.rows.map((submission) => {
                const displayName = formatQueueName(submission.grantee.user.fullName);
                return (
                  <button
                  key={submission.id}
                  type="button"
                  onClick={() => {
                    setSelectedSubmissionId(submission.id);
                    setIsMobileReviewOpen(true);
                    setActionError(null);
                    setValidationError(null);
                    setActionSuccess(null);
                  }}
                  aria-current={selectedSubmissionId === submission.id ? "true" : undefined}
                  className={`w-full rounded-xl border p-3.5 text-left transition ${
                    selectedSubmissionId === submission.id
                      ? "border-slate-300 border-l-[3px] border-l-slate-900 bg-slate-50/90 shadow-sm"
                      : "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/60 hover:shadow-sm"
                  }`}
                >
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <span
                          aria-hidden="true"
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold ${
                            selectedSubmissionId === submission.id
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {getQueueInitials(displayName)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900" title={displayName}>
                          {displayName}
                        </span>
                      </div>
                      <time
                        dateTime={submission.submittedAt}
                        title={formatDate(submission.submittedAt)}
                        className="shrink-0 text-xs tabular-nums text-slate-400"
                      >
                        {QUEUE_DATE_FORMAT.format(new Date(submission.submittedAt))}
                      </time>
                    </div>
                    <div className="ml-[46px] mt-1.5 flex min-w-0 items-center gap-1 text-[12.5px] text-slate-500">
                      <span
                        className="min-w-0 truncate"
                        title={normalizeSkeapSchoolName(submission.grantee.school)}
                      >
                        {normalizeSkeapSchoolName(submission.grantee.school)}
                      </span>
                      <span aria-hidden="true" className="shrink-0">·</span>
                      <span className="shrink-0">{submission.grantee.yearLevel}</span>
                    </div>
                    <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
                      <span
                        title={submission.semester}
                        className="inline-flex min-w-0 max-w-[55%] truncate rounded-md border border-slate-200 bg-white/80 px-1.5 py-1 text-[10px] font-semibold text-slate-600"
                      >
                        {formatQueueSemester(submission.semester)}
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <QueueDocumentBadge
                          label="COE"
                          status={submission.coeStatus}
                          submissionStatus={submission.status}
                          isResubmitted={submission.resubmittedFields?.includes("COE") ?? false}
                        />
                        <QueueDocumentBadge
                          label="Grades"
                          status={submission.gradesStatus}
                          submissionStatus={submission.status}
                          isResubmitted={submission.resubmittedFields?.includes("GRADE_REPORT") ?? false}
                          hasPossibleFailingGrade={submission.gradeDiagnostics?.hasPossibleFailingGrade ?? false}
                        />
                      </span>
                    </div>
                  </button>
                );
              })}
              </div>
            </div>

            <div className="mt-auto flex shrink-0 flex-wrap items-center justify-between gap-4 border-t border-slate-200/80 px-5 py-3.5">
              <p className="inline-flex h-8 items-center gap-1.5 text-xs text-slate-500 tabular-nums">
                <span>Showing</span>
                <span className="font-semibold text-slate-900">{pageRangeStart}–{pageRangeEnd}</span>
                <span>of</span>
                <span className="font-semibold text-slate-900">{responseData.totalCount.toLocaleString()}</span>
                <span>{activeTab === "resubmitted"
                  ? `resubmitted ${responseData.totalCount === 1 ? "package" : "packages"}`
                  : activeTabRecordLabel}
                </span>
              </p>
              {responseData.totalPages > 1 ? (
                <div className="flex flex-wrap items-center gap-4">
                  <label className="inline-flex h-8 items-center gap-2 border-l border-slate-200 pl-4 text-xs text-slate-500">
                    <span>Rows per page</span>
                    <select
                      aria-label="Rows per page"
                      value={pageSize}
                      onChange={(event) => {
                        setPageSize(Number(event.target.value));
                        setPage(1);
                        setSelectedSubmissionId(null);
                        setIsMobileReviewOpen(false);
                        setIsLoading(true);
                      }}
                      className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700"
                    >
                      {ADMIN_TABLE_PAGE_SIZES.map((size) => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
              {responseData.totalPages > 1 ? (
                <AdminPaginationControls
                  page={page}
                  totalPages={responseData.totalPages}
                  onPageChange={(nextPage) => {
                    setPage(nextPage);
                    setIsLoading(true);
                  }}
                  disabled={isLoading}
                />
              ) : null}
            </div>
          </aside>

          <section className={`${isMobileReviewOpen ? "flex" : "hidden lg:flex"} min-h-[320px] flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm lg:col-span-8 lg:h-full lg:min-h-0`}>
            {!selectedSubmission ? (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-6 py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <FileText className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-base font-bold text-slate-900">Select a grantee from the left to review their documents.</h2>
                <p className="mt-1 text-sm text-slate-500">Choose a package from the submission queue to begin.</p>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsMobileReviewOpen(false)}
                  className="inline-flex items-center gap-2 self-start px-5 pt-4 text-xs font-semibold text-slate-600 transition-colors hover:text-slate-900 lg:hidden"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back to Submissions Queue
                </button>
                <header className="shrink-0 border-b border-slate-100 bg-white px-5 pb-4 pt-4 sm:px-7 sm:pt-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Submission Review</p>
                      <h2 className="truncate text-lg font-bold leading-tight tracking-tight text-slate-950">
                        {selectedSubmission.grantee.user.fullName}
                      </h2>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {selectedSubmission.status === "APPROVED" ? (
                        <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" />
                          Fully cleared
                        </span>
                      ) : selectedSubmission.status === "AWAITING_PHYSICAL_CTC" ? (
                        <>
                          <span className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                            For Physical CTC
                          </span>
                          <button
                            type="button"
                            onClick={() => void confirmPhysicalCtc()}
                            disabled={isSaving}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Confirm Physical CTC &amp; Clear
                          </button>
                        </>
                      ) : (
                        <>
                          {selectedSubmission.status === "PENDING" ? (
                            <button
                              type="button"
                              onClick={() => void verifyDigitalAndRequestPhysicalCtc()}
                              disabled={isSaving || !canVerifyDigital}
                              title={!canVerifyDigital ? "Approve both digital documents and clear all correction flags first." : undefined}
                              className="inline-flex items-center gap-2 rounded-xl bg-[#0a1f33] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#122e48] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Verify Digital &amp; Request Original/CTC
                            </button>
                          ) : null}
                        </>
                      )}
                      {canShowPrimaryRevoke ? (
                        <button
                          type="button"
                          onClick={() => setIsRevokeModalOpen(true)}
                          disabled={isSaving}
                          className="inline-flex items-center gap-2 rounded-lg border border-transparent bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                          Revoke Grantee
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-1.5 gap-y-0.5 text-[10px] leading-relaxed text-slate-500">
                    <span>{selectedSubmission.grantee.user.email}</span>
                    <span aria-hidden="true">·</span>
                    <span>{normalizeSkeapSchoolName(selectedSubmission.grantee.school)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{selectedSubmission.grantee.yearLevel}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-1.5 text-[10px] leading-relaxed text-slate-500">
                    <span>{selectedSubmission.semester}</span>
                    <span aria-hidden="true">·</span>
                    <span>Submitted {formatDate(selectedSubmission.submittedAt)}</span>
                    <span aria-hidden="true">·</span>
                  </div>
                  {selectedSubmission.status === "AWAITING_PHYSICAL_CTC" ? (
                    <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs leading-relaxed text-amber-900">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                      <p>
                        <span className="font-bold">Digital screening complete.</span>{" "}
                        Physical Original / CTC verification is pending at the Barangay Hall.
                      </p>
                    </div>
                  ) : null}
                </header>

                <div className="review-grid min-h-0 flex-1 px-5 pb-5 pt-4 sm:px-7 sm:pb-7">
                  <DocumentCard
                    key={`${selectedSubmission.id}-coe`}
                    submissionId={selectedSubmission.id}
                    documentKind="coe"
                    title="Certificate of Enrollment"
                    notesLabel="CoE Review Notes"
                    storedFilePath={selectedSubmission.coeFileUrl}
                    badgeContent={(selectedSubmission.flaggedFields ?? []).includes("COE") ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">
                        Needs correction
                      </span>
                    ) : selectedSubmission.resubmittedFields?.includes("COE") ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[10px] font-bold text-indigo-700">
                        <Undo2 className="h-3 w-3" aria-hidden="true" />
                        Resubmitted
                      </span>
                    ) : selectedSubmission.coeStatus === "APPROVED" || selectedSubmission.status === "APPROVED" ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                        Approved
                      </span>
                    ) : undefined}
                    reviewNotesValue={draft.coe.notes || selectedSubmission.reviewNotes || ""}
                    onNotesChange={(value) => updateDraft(selectedSubmission.id, {
                      coe: { ...draft.coe, notes: value },
                    })}
                    onApprove={() => void submitDocumentReview(selectedSubmission, "coe", "APPROVE")}
                    onReturn={() => returnDocumentForUpdate(selectedSubmission, "coe")}
                    disabled={isSaving}
                    approved={selectedSubmission.coeStatus === "APPROVED" || selectedSubmission.status === "APPROVED"}
                    reviewLocked={selectedSubmission.status === "AWAITING_PHYSICAL_CTC"}
                  />

                  <DocumentCard
                    key={`${selectedSubmission.id}-grade`}
                    submissionId={selectedSubmission.id}
                    documentKind="grade"
                    title="Grade Report"
                    notesLabel="Grade Report Review Notes"
                    storedFilePath={selectedSubmission.gradeFileUrl}
                    badgeContent={selectedSubmission.gradeFileUrl ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {selectedSubmission.gradeDiagnostics?.hasPossibleFailingGrade ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                            Possible Failing Grade
                          </span>
                        ) : null}
                        {selectedSubmission.resubmittedFields?.includes("GRADE_REPORT") ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                            <Undo2 className="h-3 w-3" aria-hidden="true" />
                            Resubmitted
                          </span>
                        ) : null}
                        {gradeReportApproved &&
                        !selectedSubmission.gradeDiagnostics?.hasPossibleFailingGrade ? (
                        <span className="inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2.5 text-[10px] font-bold text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          Approved
                        </span>
                        ) : null}
                      </div>
                    ) : undefined}
                    reviewNotesValue={draft.grades.notes || selectedSubmission.reviewNotes || ""}
                    onNotesChange={(value) => updateDraft(selectedSubmission.id, {
                      grades: { ...draft.grades, notes: value },
                    })}
                    onApprove={() => void submitDocumentReview(selectedSubmission, "grades", "APPROVE")}
                    onReturn={() => returnDocumentForUpdate(selectedSubmission, "grades")}
                    disabled={isSaving || !selectedSubmission.gradeFileUrl}
                    approved={gradeReportApproved}
                    reviewLocked={selectedSubmission.status === "AWAITING_PHYSICAL_CTC"}
                  />
                </div>
              </>
            )}
          </section>
        </div>
        )}
      </div>
      <RevokeGranteeModal
        granteeId={selectedSubmission?.grantee.id ?? ""}
        open={isRevokeModalOpen && selectedSubmission !== null}
        granteeName={selectedSubmission?.grantee.user.fullName ?? "this grantee"}
        submitting={isSaving}
        error={actionError}
        onClose={() => setIsRevokeModalOpen(false)}
        onConfirm={(granteeId, reason, additionalNotes, isPermanentlyDisqualified) => {
          void revokeSelectedGrantee(granteeId, reason, additionalNotes, isPermanentlyDisqualified);
        }}
      />
    </section>
  );
}
