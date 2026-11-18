"use client";

import { useCallback, useEffect, useState } from "react";
import FloatingFeedback from "@/app/components/FloatingFeedback";
import RevokeGranteeModal from "./RevokeGranteeModal";
import type { ReactNode } from "react";
import type { SubmissionStatus } from "@prisma/client";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { normalizeSkeapSchoolName } from "@/lib/skeap-school";
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
}

interface TabDef {
  id: TabType;
  label: string;
  subtitle: string;
  icon: LucideIcon;
}

interface ActionConfirmation {
  title: string;
  description: string;
  confirmLabel: string;
  intent: "primary" | "warning";
  notes: string | null;
  notesRequired: boolean;
  notesError?: string;
  onNotesChange?: (value: string) => void;
  onConfirm: (notes?: string) => Promise<unknown>;
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
};

const TABS: TabDef[] = [
  { id: "pending", label: "Pending Review", subtitle: "in queue", icon: Clock },
  { id: "returned", label: "Returned for Edits", subtitle: "awaiting grantee re-upload", icon: Undo2 },
  { id: "resubmitted", label: "Resubmitted", subtitle: "updated digital files", icon: RefreshCw },
  { id: "physical", label: "For Physical CTC", subtitle: "awaiting in-person verification", icon: CheckCircle2 },
  { id: "cleared", label: "Fully Cleared", subtitle: "approved for payout", icon: ShieldCheck },
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

interface DocumentCardProps {
  submissionId: string;
  documentKind: "coe" | "grade";
  docKey: "COE" | "GRADE_REPORT";
  title: string;
  notesLabel: string;
  storedFilePath: string | null | undefined;
  badgeContent?: ReactNode;
  reviewNotesValue: string;
  onNotesChange: (value: string) => void;
  onApprove: () => void;
  onReturn: () => Promise<boolean>;
  pendingAction: string | null;
  documentReturned: boolean;
  awaitingReupload: boolean;
  canReview: boolean;
  disabled: boolean;
  approved: boolean;
  reviewLocked?: boolean;
}

function DocumentCard({
  submissionId,
  documentKind,
  docKey,
  title,
  notesLabel,
  storedFilePath,
  badgeContent,
  reviewNotesValue,
  onNotesChange,
  onApprove,
  onReturn,
  pendingAction,
  documentReturned,
  awaitingReupload,
  canReview,
  disabled,
  approved,
  reviewLocked = false,
}: DocumentCardProps) {
  const isReturning = pendingAction === `${docKey}:RETURN`;
  const isApproving = pendingAction === `${docKey}:APPROVE`;
  const viewerUrl = `/api/submissions/${submissionId}/file?kind=${documentKind}`;
  const [previewType, setPreviewType] = useState<"pdf" | "image" | "unsupported" | "missing" | null>(null);
  const [rawStorageUrl, setRawStorageUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  function openDocumentPreview() {
    setPreviewType(null);
    setRawStorageUrl(null);
    setIsPreviewOpen(true);
  }

  useEffect(() => {
    if (!storedFilePath || !isPreviewOpen) return;

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
  }, [isPreviewOpen, storedFilePath, viewerUrl]);

  return (
    <article className="review-card flex h-full flex-col">
      <div className="review-card__header !h-auto min-h-9 items-start gap-2">
        <div className="flex min-w-fit shrink-0 items-center gap-2">
          {documentKind === "grade" ? (
            <GraduationCap className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
          ) : (
            <FileText className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
          )}
          <h3
            className="review-card__title shrink-0"
            title={title}
          >
            {documentKind === "coe" && badgeContent ? "COE" : title}
          </h3>
        </div>
        {badgeContent || documentReturned ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1">
            {documentReturned ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                Returned for Edits
              </span>
            ) : badgeContent}
          </div>
        ) : null}
      </div>

      <div className="review-card__preview flex h-44 w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50 p-3">
        {storedFilePath ? (
          <>
            <FileText className="h-8 w-8 text-slate-400" aria-hidden="true" />
            <button
              type="button"
              onClick={openDocumentPreview}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
            >
              View document
            </button>
          </>
        ) : (
          <div className="space-y-2 text-center">
            <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/60 bg-white text-slate-700 shadow-2xs">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-700">No document uploaded</p>
              <p className="mt-0.5 text-[11px] text-slate-400">This submission does not include this document.</p>
            </div>
          </div>
        )}
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
                disabled={disabled || pendingAction !== null}
                readOnly={awaitingReupload}
                onChange={(event) => onNotesChange(event.target.value)}
                className={`flex-1 w-full min-h-[140px] resize-none placeholder:text-slate-400 ${
                  awaitingReupload
                    ? "cursor-default bg-slate-50/70 text-slate-600"
                    : "text-slate-900"
                }`}
              />
            </div>
          </>
        )}
      </div>

      {awaitingReupload ? (
        <div className="review-card__actions review-card__actions--single">
          <button
            type="button"
            disabled
            className="review-button w-full !cursor-not-allowed border border-slate-200 bg-slate-50 text-slate-400"
          >
            <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
            Awaiting Grantee Re-upload
          </button>
        </div>
      ) : approved ? (
        <div className="review-card__actions review-card__actions--single">
          <button
            type="button"
            onClick={onReturn}
            disabled={!canReview || disabled || pendingAction !== null}
            className="review-button review-button--return inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {isReturning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
                <span>Returning...</span>
              </>
            ) : (
              <>
                <Undo2 className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                <span>Return / Undo</span>
              </>
            )}
          </button>
        </div>
      ) : documentKind === "grade" ? (
        <div className="review-card__actions">
          <button
            type="button"
            onClick={onReturn}
            disabled={!canReview || disabled || pendingAction !== null}
            className="review-button review-button--return inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {isReturning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
                <span>Returning...</span>
              </>
            ) : (
              <>
                <Undo2 className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                Return
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onApprove}
            disabled={!canReview || disabled || pendingAction !== null}
            className="review-button review-button--approve inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {isApproving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
                <span>Approving...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Approve Grades
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="review-card__actions">
          <button
            type="button"
            onClick={onReturn}
            disabled={!canReview || disabled || pendingAction !== null}
            className="review-button review-button--return inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {isReturning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
                <span>Returning...</span>
              </>
            ) : (
              <>
                <Undo2 className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                <span>Return</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onApprove}
            disabled={!canReview || disabled || pendingAction !== null}
            className="review-button review-button--approve inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {isApproving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
                <span>Approving...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{approved ? "Approved" : "Approve"}</span>
              </>
            )}
          </button>
        </div>
      )}

      {isPreviewOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${title} preview`}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/75 p-4"
          onClick={() => setIsPreviewOpen(false)}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-3">
              <h3 className="truncate text-sm font-semibold text-slate-900">{title}</h3>
              <div className="flex items-center gap-2">
                {rawStorageUrl ? (
                  <a
                    href={rawStorageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-sky-700 underline"
                  >
                    Open in new tab
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  aria-label="Close document preview"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </header>
            <div className="min-h-[40vh] overflow-auto bg-slate-100 p-4">
              {previewType === "pdf" ? (
                <iframe
                  src={viewerUrl}
                  title={`${title} preview`}
                  loading="lazy"
                  className="h-[75vh] w-full border-0 bg-white"
                />
              ) : previewType === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={viewerUrl}
                  alt={title}
                  loading="lazy"
                  className="mx-auto max-h-[75vh] max-w-full object-contain"
                />
              ) : previewType === null ? (
                <div className="flex h-[40vh] items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Checking document...
                </div>
              ) : (
                <p role="alert" className="py-16 text-center text-sm text-slate-600">
                  {previewType === "missing"
                    ? "The uploaded file is missing from storage."
                    : "Preview is not available for this file."}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
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
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [actionConfirmation, setActionConfirmation] = useState<ActionConfirmation | null>(null);
  const [isConfirmingAction, setIsConfirmingAction] = useState(false);
  const [isScreenConfirmOpen, setIsScreenConfirmOpen] = useState(false);
  const [screenRemarks, setScreenRemarks] = useState("");
  const [isSubmittingScreen, setIsSubmittingScreen] = useState(false);

  const refreshSubmissionState = useCallback(async (
    tab: TabType,
    requestedPage: number,
    signal?: AbortSignal,
  ) => {
    const params = new URLSearchParams({
      status: tab,
      page: String(requestedPage),
      limit: String(pageSize),
      search: query.trim(),
    });
    const result = await fetch(`/api/admin/submissions?${params}`, {
      cache: "no-store",
      signal,
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
    setPage(nextResponse.page ?? requestedPage);
  }, [pageSize, query]);

  useEffect(() => {
    if (!actionSuccess) return;
    const timeout = window.setTimeout(() => setActionSuccess(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [actionSuccess]);

  useEffect(() => {
    if (!isScreenConfirmOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmittingScreen) {
        setIsScreenConfirmOpen(false);
        setScreenRemarks("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isScreenConfirmOpen, isSubmittingScreen]);

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
      try {
        await refreshSubmissionState(activeTab, page, controller.signal);
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
  }, [activeTab, page, pageSize, query, refreshToken, refreshSubmissionState]);

  const selectedSubmission =
    responseData.rows.find((submission) => submission.id === selectedSubmissionId) ?? null;
  const submissionAwaitingReupload = selectedSubmission?.status === "RETURNED_FOR_EDIT";
  const coeReturned = selectedSubmission?.coeStatus === "RETURNED_FOR_EDIT";
  const gradeReportReturned = selectedSubmission?.gradesStatus === "RETURNED_FOR_EDIT";
  const canReviewDocuments = selectedSubmission?.status === "PENDING";
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
    Boolean(selectedSubmission.coeFileUrl) &&
    Boolean(selectedSubmission.gradeFileUrl) &&
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

    const docKey = docType === "coe" ? "COE" : "GRADE_REPORT";
    const actionKey = `${docKey}:${action === "APPROVE" ? "APPROVE" : "RETURN"}`;
    setPendingAction(actionKey);
    setSavingSubmissionId(submission.id);
    setActionError(null);
    setValidationError(null);
    setActionSuccess(null);
    try {
      await postDocumentReview(submission, docType, action, reviewNotes.trim());
      updateDraft(submission.id, { [docType]: { status: "PENDING", notes: "" } });
      if (action === "RETURN_FOR_UPDATE") {
        changeTab("returned");
        await refreshSubmissionState("returned", 1);
      } else {
        await refreshSubmissionState(activeTab, page);
      }
      setActionSuccess(
        action === "APPROVE"
          ? `${docType === "coe" ? "Certificate of Enrollment" : "Grade Report"} approved.`
          : `${docType === "coe" ? "Certificate of Enrollment" : "Grade Report"} returned for edits.`
      );
      return true;
    } catch (error) {
      handleActionError(error, "Unable to process review action.", submission.grantee.id);
      return false;
    } finally {
      setSavingSubmissionId(null);
      setPendingAction(null);
      setIsLoading(false);
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

  function requestDocumentReviewConfirmation(
    submission: SubmissionRow,
    docType: "coe" | "grades",
    action: "APPROVE" | "RETURN_FOR_UPDATE",
  ): Promise<boolean> {
    const documentName = docType === "coe" ? "Certificate of Enrollment" : "Grade Report";
    if (action === "APPROVE") {
      setActionConfirmation({
        title: `Approve ${documentName}?`,
        description: "This will approve the resubmitted digital document and update the review queue.",
        confirmLabel: `Approve ${docType === "coe" ? "COE" : "Grades"}`,
        intent: "primary",
        notes: null,
        notesRequired: false,
        onConfirm: () => submitDocumentReview(submission, docType, action),
      });
      return Promise.resolve(false);
    }

    const documentDraft = reviewDrafts[submission.id]?.[docType] ?? EMPTY_REVIEW_DRAFT[docType];
    const initialNotes = documentDraft.notes || submission.reviewNotes || "";
    setValidationError(null);
    setActionConfirmation({
      title: `Return ${documentName} for edits?`,
      description: "The grantee will need to correct and re-upload this document. Add or review the feedback before returning it.",
      confirmLabel: "Return for Edits",
      intent: "warning",
      notes: initialNotes,
      notesRequired: true,
      onNotesChange: (value) => {
        setActionConfirmation((current) => current ? { ...current, notes: value } : current);
        if (docType === "coe") {
          updateDraft(submission.id, {
            coe: { ...documentDraft, notes: value },
          });
        } else {
          updateDraft(submission.id, {
            grades: { ...documentDraft, notes: value },
          });
        }
      },
      onConfirm: (notes) => submitDocumentReview(submission, docType, action, notes),
    });
    return Promise.resolve(false);
  }

  async function confirmAction() {
    const confirmation = actionConfirmation;
    if (!confirmation || isConfirmingAction) return;
    if (confirmation.notesRequired && !confirmation.notes?.trim()) {
      setActionConfirmation((current) => current
        ? { ...current, notesError: "Add review notes before returning a document for edits." }
        : current);
      return;
    }

    setIsConfirmingAction(true);
    try {
      await confirmation.onConfirm(confirmation.notes?.trim());
    } finally {
      setActionConfirmation(null);
      setIsConfirmingAction(false);
    }
  }

  async function postSubmissionAction(
    submission: SubmissionRow,
    action: "VERIFY_DIGITAL" | "CONFIRM_PHYSICAL_CTC",
    reviewNotes?: string,
  ) {
    const response = await fetch(`/api/admin/submissions/${submission.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        ...(reviewNotes?.trim() ? { reviewNotes: reviewNotes.trim() } : {}),
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || "Unable to update submission verification status.");
    }
  }

  async function verifyDigitalAndRequestPhysicalCtc(reviewNotes: string): Promise<boolean> {
    if (!selectedSubmission || isSaving) return false;
    if (!canVerifyDigital) {
      setValidationError("Approve both digital documents and clear all correction flags before requesting physical verification.");
      return false;
    }

    setSavingSubmissionId(selectedSubmission.id);
    setActionError(null);
    setValidationError(null);
    setActionSuccess(null);
    try {
      await postSubmissionAction(selectedSubmission, "VERIFY_DIGITAL", reviewNotes);
      setActionSuccess("Digital pre-check complete. The grantee has been asked to submit the Original / CTC.");
      changeTab("physical", selectedSubmission.id);
      return true;
    } catch (error) {
      handleActionError(error, "Unable to process submission review.", selectedSubmission.grantee.id);
      if (!(error instanceof Error && error.message === "This grantee has already been revoked.")) {
        setIsLoading(true);
        setRefreshToken((current) => current + 1);
      }
      return false;
    } finally {
      setSavingSubmissionId(null);
    }
  }

  async function confirmDigitalScreening() {
    if (!selectedSubmission || isSubmittingScreen || isSaving || !canVerifyDigital) return;

    const submission = selectedSubmission;
    setIsSubmittingScreen(true);
    try {
      const succeeded = await verifyDigitalAndRequestPhysicalCtc(screenRemarks.trim());
      if (succeeded) {
        setIsScreenConfirmOpen(false);
        setScreenRemarks("");
      }
    } catch (error) {
      handleActionError(error, "Unable to process submission review.", submission.grantee.id);
    } finally {
      setIsSubmittingScreen(false);
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
          setActionError(payload?.error || "Grantee was revoked, but a follow-up notification failed.");
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
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => changeTab(tab.id)}
                aria-pressed={isActive}
                className={`group relative flex w-full flex-col gap-2 overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-[0_6px_24px_-6px_rgba(14,116,144,0.09)] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                  isActive
                    ? "border-[1.5px] border-[#0a1f33]"
                    : "border-slate-200/75 hover:border-slate-300"
                }`}
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(ellipse 58% 70% at 95% 5%, rgba(56, 189, 248, 0.16) 0%, rgba(103, 232, 249, 0.06) 42%, transparent 100%)",
                  }}
                />
                <div className="relative z-10 flex min-w-0 items-center justify-between gap-2 sm:gap-3">
                  <span className={`min-w-0 truncate text-[10px] font-bold uppercase tracking-widest ${isActive ? "text-[#0891b2]" : "text-slate-400"}`}>
                    {tab.label}
                  </span>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110 ${
                    isActive
                      ? "bg-[#0891b2] text-white shadow-[0_0_0_5px_rgba(8,145,178,0.10)]"
                      : "border border-sky-100 bg-sky-50/90 text-cyan-600"
                  }`}>
                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  </span>
                </div>
                <div className="relative z-10">
                  <h3 className="text-2xl font-extrabold tabular-nums leading-none tracking-tight text-slate-950">
                    {responseData.counts[tab.id]}
                  </h3>
                  <p className={`mt-1 text-[11px] font-medium ${isActive ? "text-slate-500" : "text-slate-400"}`}>
                    {tab.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 p-4 sm:p-5" aria-busy={isLoading}>
        {loadError ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</div> : null}
        {validationError ? (
          <FloatingFeedback
            message={validationError}
            type="error"
            autoDismissMs={5000}
            onDismiss={() => setValidationError(null)}
          />
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

            <div className="shrink-0 border-b border-slate-100 bg-white p-3">
              <label className="relative block">
                <span className="sr-only">Search grantee, school or semester</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
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
                  className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-cyan-600 focus:bg-white"
                />
              </label>
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
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    selectedSubmissionId === submission.id
                      ? "border-[1.5px] border-slate-900 bg-slate-50/70 shadow-sm"
                      : "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/60 hover:shadow-sm"
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900" title={displayName}>
                        {displayName}
                      </span>
                      <time
                        dateTime={submission.submittedAt}
                        title={formatDate(submission.submittedAt)}
                        className="shrink-0 text-xs tabular-nums text-slate-400"
                      >
                        {formatDate(submission.submittedAt)}
                      </time>
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {submission.grantee.user.email}
                    </div>
                    <div className="truncate text-xs font-medium text-slate-600">
                      {submission.semester}
                    </div>
                    <div className="truncate text-xs text-slate-400">
                      {normalizeSkeapSchoolName(submission.grantee.school)} · {submission.grantee.yearLevel}
                    </div>
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
                    <div className="inline-flex shrink-0 flex-wrap items-center gap-2.5">
                      {selectedSubmission.status === "APPROVED" ? (
                        <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" />
                          Fully cleared
                        </span>
                      ) : selectedSubmission.status === "AWAITING_PHYSICAL_CTC" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setActionConfirmation({
                              title: "Confirm physical CTC and clear submission?",
                              description: "Confirm that the grantee's physical Original / CTC has been verified. This will fully clear the submission.",
                              confirmLabel: "Confirm",
                              intent: "primary",
                              notes: null,
                              notesRequired: false,
                              onConfirm: confirmPhysicalCtc,
                            })}
                            disabled={isSaving}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold whitespace-nowrap text-white shadow-xs transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isSaving ? (
                              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                            )}
                            {isSaving ? "Confirming..." : "Confirm Physical CTC"}
                          </button>
                        </>
                      ) : (
                        <>
                          {selectedSubmission.status === "PENDING" ? (
                            <button
                              type="button"
                              onClick={() => {
                                setScreenRemarks("");
                                setIsScreenConfirmOpen(true);
                              }}
                              disabled={isSaving || isSubmittingScreen || !canVerifyDigital}
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
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold whitespace-nowrap text-white shadow-xs transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                    docKey="COE"
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
                    reviewNotesValue={coeReturned
                      ? selectedSubmission.reviewNotes || ""
                      : draft.coe.notes || selectedSubmission.reviewNotes || ""}
                    onNotesChange={(value) => updateDraft(selectedSubmission.id, {
                      coe: { ...draft.coe, notes: value },
                    })}
                    onApprove={() => {
                      if (activeTab === "resubmitted") {
                        void requestDocumentReviewConfirmation(selectedSubmission, "coe", "APPROVE");
                      } else {
                        void submitDocumentReview(selectedSubmission, "coe", "APPROVE");
                      }
                    }}
                    onReturn={() => activeTab === "resubmitted"
                      ? requestDocumentReviewConfirmation(selectedSubmission, "coe", "RETURN_FOR_UPDATE")
                      : returnDocumentForUpdate(selectedSubmission, "coe")}
                    pendingAction={pendingAction}
                    documentReturned={coeReturned}
                    awaitingReupload={submissionAwaitingReupload || coeReturned}
                    canReview={canReviewDocuments}
                    disabled={isSaving}
                    approved={selectedSubmission.coeStatus === "APPROVED" || selectedSubmission.status === "APPROVED"}
                    reviewLocked={selectedSubmission.status === "AWAITING_PHYSICAL_CTC"}
                  />

                  <DocumentCard
                    key={`${selectedSubmission.id}-grade`}
                    submissionId={selectedSubmission.id}
                    documentKind="grade"
                    docKey="GRADE_REPORT"
                    title="Grade Report"
                    notesLabel="Grade Report Review Notes"
                    storedFilePath={selectedSubmission.gradeFileUrl}
                    badgeContent={selectedSubmission.gradeFileUrl ? (
                      <>
                        {selectedSubmission.gradeDiagnostics?.hasPossibleFailingGrade ? (
                          <span
                            title={
                              selectedSubmission.gradeDiagnostics.flaggedGrades.length > 0
                                ? `${selectedSubmission.semester}: ${selectedSubmission.gradeDiagnostics.flaggedGrades.join("; ")}`
                                : `${selectedSubmission.semester}: ${
                                    selectedSubmission.gradeDiagnostics.possibleFailingGradeMessage ??
                                    "OCR detected a grade requiring review."
                                  }`
                            }
                            className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap text-amber-800"
                          >
                            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                            Possible Failing Grade
                          </span>
                        ) : null}
                        {gradeReportApproved &&
                        !selectedSubmission.gradeDiagnostics?.hasPossibleFailingGrade ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          Approved
                        </span>
                        ) : null}
                      </>
                    ) : undefined}
                    reviewNotesValue={gradeReportReturned
                      ? selectedSubmission.reviewNotes || ""
                      : draft.grades.notes || selectedSubmission.reviewNotes || ""}
                    onNotesChange={(value) => updateDraft(selectedSubmission.id, {
                      grades: { ...draft.grades, notes: value },
                    })}
                    onApprove={() => {
                      if (activeTab === "resubmitted") {
                        void requestDocumentReviewConfirmation(selectedSubmission, "grades", "APPROVE");
                      } else {
                        void submitDocumentReview(selectedSubmission, "grades", "APPROVE");
                      }
                    }}
                    onReturn={() => activeTab === "resubmitted"
                      ? requestDocumentReviewConfirmation(selectedSubmission, "grades", "RETURN_FOR_UPDATE")
                      : returnDocumentForUpdate(selectedSubmission, "grades")}
                    pendingAction={pendingAction}
                    documentReturned={gradeReportReturned}
                    awaitingReupload={submissionAwaitingReupload || gradeReportReturned}
                    canReview={canReviewDocuments}
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
      {isScreenConfirmOpen && selectedSubmission ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-xs"
          onClick={(event) => {
            if (event.target === event.currentTarget && !isSubmittingScreen) {
              setIsScreenConfirmOpen(false);
              setScreenRemarks("");
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="digital-screen-confirmation-title"
            aria-describedby="digital-screen-confirmation-description"
            className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl"
          >
            <header className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-900">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Digital Screening Confirmation
                </p>
                <h2 id="digital-screen-confirmation-title" className="text-base font-semibold text-slate-900">
                  Move Submission to For Physical CTC?
                </h2>
              </div>
            </header>

            <div className="mt-4 space-y-1.5 rounded-xl border border-slate-200/80 bg-slate-50/75 p-3.5">
              <p className="text-sm font-semibold text-slate-900">
                {selectedSubmission.grantee.user.fullName}
              </p>
              <p className="text-xs text-slate-600">
                {selectedSubmission.grantee.user.email || "No email address on file"}
              </p>
              <p className="text-xs text-slate-500">
                {selectedSubmission.semester} ·{" "}
                {[selectedSubmission.coeFileUrl, selectedSubmission.gradeFileUrl].filter(Boolean).length} documents
              </p>
            </div>

            <p
              id="digital-screen-confirmation-description"
              className="mt-3.5 rounded-xl border border-amber-200/75 bg-amber-50/60 px-3.5 py-2.5 text-xs leading-relaxed text-amber-900"
            >
              Confirming will mark these digital files as screened and automatically notify the grantee via email
              and in-app alert to present physical Certified True Copies (CTCs) at Barangay Pico Hall.
            </p>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-medium text-slate-700">
                Reviewer Note (Optional)
              </span>
              <textarea
                autoFocus
                rows={2}
                value={screenRemarks}
                onChange={(event) => setScreenRemarks(event.currentTarget.value)}
                disabled={isSubmittingScreen}
                placeholder="Add any specific instructions for physical CTC verification..."
                className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#0d5c75] focus:ring-2 focus:ring-[#0d5c75]/15 disabled:cursor-not-allowed disabled:bg-slate-50"
              />
            </label>

            <footer className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsScreenConfirmOpen(false);
                  setScreenRemarks("");
                }}
                disabled={isSubmittingScreen}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDigitalScreening()}
                disabled={isSubmittingScreen || isSaving || !canVerifyDigital}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 sm:text-sm"
              >
                {isSubmittingScreen ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {isSubmittingScreen ? "Confirming..." : "Confirm & Notify Grantee"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
      {actionConfirmation ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
          onClick={(event) => {
            if (event.target === event.currentTarget && !isConfirmingAction) {
              setActionConfirmation(null);
            }
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="submission-action-confirmation-title"
            aria-describedby="submission-action-confirmation-description"
            className="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  actionConfirmation.intent === "warning"
                    ? "border border-amber-200 bg-amber-50 text-amber-700"
                    : "border border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}>
                  {actionConfirmation.intent === "warning"
                    ? <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                    : <CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
                </span>
                <h2 id="submission-action-confirmation-title" className="text-base font-bold text-slate-900">
                  {actionConfirmation.title}
                </h2>
              </div>
              <p id="submission-action-confirmation-description" className="text-sm leading-relaxed text-slate-600">
                {actionConfirmation.description}
              </p>
            </div>

            {actionConfirmation.notesRequired ? (
              <label className="block space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Review notes <span className="text-rose-600" aria-hidden="true">*</span>
                </span>
                <textarea
                  autoFocus
                  rows={4}
                  required
                  value={actionConfirmation.notes ?? ""}
                  onChange={(event) => {
                    actionConfirmation.onNotesChange?.(event.currentTarget.value);
                    setActionConfirmation((current) => current
                      ? { ...current, notesError: undefined }
                      : current);
                  }}
                  disabled={isConfirmingAction}
                  placeholder="Explain what the grantee needs to correct..."
                  className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
                {actionConfirmation.notesError ? (
                  <span role="alert" className="block text-xs font-medium text-rose-700">
                    {actionConfirmation.notesError}
                  </span>
                ) : null}
              </label>
            ) : null}

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setActionConfirmation(null)}
                disabled={isConfirmingAction}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmAction()}
                disabled={isConfirmingAction}
                autoFocus={!actionConfirmation.notesRequired}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  actionConfirmation.intent === "warning"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-emerald-700 hover:bg-emerald-800"
                }`}
              >
                {isConfirmingAction ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {isConfirmingAction ? "Processing..." : actionConfirmation.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      ) : null}
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
