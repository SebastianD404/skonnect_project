"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FloatingFeedback from "@/app/components/FloatingFeedback";
import type { ReactNode } from "react";
import type { SubmissionStatus } from "@prisma/client";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileText,
  GraduationCap,
  Loader2,
  Search,
  Trash2,
  Undo2,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { normalizeSkeapSchoolName } from "@/lib/skeap-school";
import { parseVerifiedGwa } from "@/lib/grade-report-review";
import type { AcademicTermWindow } from "@/lib/academic-term-schedule";

interface SubmissionRow {
  id: string;
  semester: string;
  gradeFileUrl: string;
  coeFileUrl: string;
  generalAverage: number | null;
  verifiedGwa: number | null;
  requiresStrictManualReview: boolean;
  gradeRows?: Array<{ subject: string; grade: number }> | null;
  status: SubmissionStatus;
  coeStatus: SubmissionStatus;
  gradesStatus: SubmissionStatus;
  reviewNotes: string | null;
  flaggedFields?: string[];
  submittedAt: string;
  grantee: {
    user: { fullName: string; email: string };
    school: string;
    yearLevel: string;
    generalAverage?: number | null;
  };
}

type TabType = "pending" | "returned" | "cleared";
type DocumentReview = { status: "PENDING" | "APPROVED" | "RETURN_FOR_UPDATE"; notes: string };
type ReviewDraft = { coe: DocumentReview; grades: DocumentReview };
type GradeVerification = {
  noFailing: boolean;
  noInc: boolean;
  noDropped: boolean;
  verifiedGwa: string;
};

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

const PAGE_SIZE_DEFAULT = 10;
const EMPTY_REVIEW_DRAFT: ReviewDraft = {
  coe: { status: "PENDING", notes: "" },
  grades: { status: "PENDING", notes: "" },
};
const EMPTY_RESPONSE: SubmissionsResponse = {
  rows: [],
  counts: { pending: 0, returned: 0, cleared: 0 },
  totalCount: 0,
  page: 1,
  pageSize: PAGE_SIZE_DEFAULT,
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
  { id: "pending", label: "Pending Review", description: "Complete submissions awaiting review" },
  { id: "returned", label: "Returned for Edits", description: "Submissions returned to grantees" },
  { id: "cleared", label: "Fully Cleared", description: "Submissions approved by an administrator" },
];
const QUEUE_TITLES: Record<TabType, string> = {
  pending: "Review Queue",
  returned: "Returned Submissions",
  cleared: "Cleared Records",
};

function getStatusLabel(status: SubmissionStatus) {
  if (status === "APPROVED") return "Fully Cleared";
  if (status === "RETURNED_FOR_EDIT" || status === "REJECTED") return "Returned for Edits";
  return "Pending Review";
}

function getStatusClass(status: SubmissionStatus) {
  if (status === "APPROVED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "RETURNED_FOR_EDIT" || status === "REJECTED") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
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
  gradeVerification?: Omit<GradeVerification, "verifiedGwa">;
  verifiedGwa?: string;
  onGradeVerificationChange?: (updates: Partial<Omit<GradeVerification, "verifiedGwa">>) => void;
  onVerifiedGwaChange?: (value: string) => void;
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
  gradeVerification = { noFailing: false, noInc: false, noDropped: false },
  verifiedGwa = "",
  onGradeVerificationChange,
  onVerifiedGwaChange,
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
          (contentType && ["image/gif", "image/jpeg", "image/png", "image/webp"].includes(contentType)) ||
          (!contentType && ["gif", "jpeg", "jpg", "png", "webp"].includes(extension))
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
    <article className="review-card">
      <div className="review-card__header">
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

      <div className={`review-card__preview group relative ${storedFilePath && previewType !== null && previewType !== "missing" ? "cursor-pointer" : ""}`}>
        {previewType === "pdf" ? (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100">
              <FileText className="h-6 w-6 text-rose-600" aria-hidden="true" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
              PDF Document
            </span>
          </div>
        ) : previewType === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={viewerUrl} alt={title} className="h-full w-full object-contain" />
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
        {storedFilePath && rawStorageUrl && previewType !== null && previewType !== "missing" ? (
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

      {documentKind === "grade" ? (
        <div className="flex shrink-0 flex-col gap-3 pl-1">
          <div className="grid grid-cols-3 gap-1.5">
            {approved ? (
              <>
                <span title="No failing grades (5.00 or 74)" className="inline-flex min-w-0 items-center justify-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-1.5 text-[9px] font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">No failing</span>
                </span>
                <span title="No incomplete (INC) grades" className="inline-flex min-w-0 items-center justify-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-1.5 text-[9px] font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">No INC</span>
                </span>
                <span title="No dropped subjects (DRP)" className="inline-flex min-w-0 items-center justify-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-1.5 text-[9px] font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">No DRP</span>
                </span>
              </>
            ) : (
              <>
                <label
                  title="No failing grades (5.00 or 74)"
                  className={`inline-flex min-w-0 cursor-pointer items-center justify-center gap-1 rounded-full border px-1.5 py-1.5 text-[9px] font-semibold transition-colors ${
                    gradeVerification.noFailing
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={gradeVerification.noFailing}
                    disabled={disabled}
                    onChange={(event) => onGradeVerificationChange?.({ noFailing: event.target.checked })}
                    aria-label="No failing grades (5.00 or 74)"
                    className="h-3 w-3 shrink-0 cursor-pointer rounded border-slate-300 accent-emerald-600 focus:ring-0 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                  />
                  <span className="truncate">No failing</span>
                </label>
                <label
                  title="No incomplete (INC) grades"
                  className={`inline-flex min-w-0 cursor-pointer items-center justify-center gap-1 rounded-full border px-1.5 py-1.5 text-[9px] font-semibold transition-colors ${
                    gradeVerification.noInc
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={gradeVerification.noInc}
                    disabled={disabled}
                    onChange={(event) => onGradeVerificationChange?.({ noInc: event.target.checked })}
                    aria-label="No incomplete (INC) grades"
                    className="h-3 w-3 shrink-0 cursor-pointer rounded border-slate-300 accent-emerald-600 focus:ring-0 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                  />
                  <span className="truncate">No INC</span>
                </label>
                <label
                  title="No dropped subjects (DRP)"
                  className={`inline-flex min-w-0 cursor-pointer items-center justify-center gap-1 rounded-full border px-1.5 py-1.5 text-[9px] font-semibold transition-colors ${
                    gradeVerification.noDropped
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={gradeVerification.noDropped}
                    disabled={disabled}
                    onChange={(event) => onGradeVerificationChange?.({ noDropped: event.target.checked })}
                    aria-label="No dropped subjects (DRP)"
                    className="h-3 w-3 shrink-0 cursor-pointer rounded border-slate-300 accent-emerald-600 focus:ring-0 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                  />
                  <span className="truncate">No DRP</span>
                </label>
              </>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Verified GWA:
            </span>
            <input
              type="text"
              value={verifiedGwa}
              disabled={disabled || approved}
              onChange={(event) => onVerifiedGwaChange?.(event.target.value)}
              placeholder="e.g. 1.25 or 92"
              aria-label="Verified GWA"
              className={`h-8 w-28 rounded-xl border px-2.5 text-xs shadow-2xs outline-none transition-colors ${
                approved
                  ? "border-emerald-200 bg-emerald-50 font-semibold text-emerald-800"
                  : "border-slate-200 bg-slate-50 focus:border-emerald-500"
              }`}
            />
          </div>
        </div>
      ) : null}

      <div className="review-card__notes">
        <label>{notesLabel}</label>
        <textarea
          rows={2}
          placeholder="Add feedback for the grantee..."
          value={reviewNotesValue}
          disabled={disabled || approved}
          onChange={(event) => onNotesChange(event.target.value)}
          className="text-slate-900 placeholder:text-slate-400"
        />
      </div>

      {documentKind === "grade" ? (
        <div className="review-card__actions">
          <button
            type="button"
            onClick={onReturn}
            disabled={disabled || approved}
            className="review-button review-button--return"
          >
            <Undo2 className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            <span>Return</span>
          </button>
          <button
            type="button"
            onClick={onApprove}
            disabled={
              disabled ||
              approved ||
              !gradeVerification.noFailing ||
              !gradeVerification.noInc ||
              !gradeVerification.noDropped ||
              parseVerifiedGwa(verifiedGwa) === null
            }
            className="review-button review-button--approve"
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{approved ? "Approved" : "Approve Grades"}</span>
          </button>
        </div>
      ) : (
        <div className="review-card__actions">
          <button
            type="button"
            onClick={onReturn}
            disabled={disabled || approved}
            className="review-button review-button--return"
          >
            <Undo2 className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            <span>Return</span>
          </button>
          <button
            type="button"
            onClick={onApprove}
            disabled={disabled || approved}
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

function OcrGwaBadge({
  submissionId,
}: {
  submissionId: string;
}) {
  const [ocrStatus, setOcrStatus] = useState<string>("OCR_PENDING");
  const [ocrGwa, setOcrGwa] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    async function loadOcrStatus(): Promise<void> {
      try {
        const response = await fetch(`/api/admin/submissions/${submissionId}/ocr`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not load OCR status.");
        const payload = body as { ocrStatus: string; ocrGwa: number | null };
        setOcrGwa(payload.ocrGwa);
        setOcrStatus(payload.ocrStatus);
        if (payload.ocrStatus === "OCR_PENDING") {
          timeoutId = setTimeout(() => void loadOcrStatus(), 2500);
        }
      } catch (error: unknown) {
        if (controller.signal.aborted) return;
        console.error("Could not load submission OCR status:", error);
        setOcrStatus("OCR_FAILED");
      }
    }

    void loadOcrStatus();

    return () => {
      controller.abort();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [submissionId]);

  const gwa = ocrGwa;
  const needsManualReview =
    ocrStatus === "OCR_FAILED" ||
    ocrStatus === "OCR_NEEDS_REVIEW" ||
    (ocrStatus !== "OCR_PENDING" && gwa === null);

  return (
    <div className={`flex h-7 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 text-xs font-bold ${
      needsManualReview
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-sky-200 bg-sky-50 text-sky-700"
    }`}>
      <span>GWA:</span>
      {ocrStatus === "OCR_PENDING" ? (
        <span className="flex items-center gap-1.5 font-medium text-sky-600">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          Processing...
        </span>
      ) : needsManualReview && gwa === null ? (
        <span className="flex items-center gap-1.5 font-semibold text-amber-700">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
          Manual Review
        </span>
      ) : (
        <span className={`font-extrabold ${needsManualReview ? "text-amber-700" : "text-[#0a1f33]"}`}>
          {gwa?.toFixed(2)}{needsManualReview ? " · Review" : ""}
        </span>
      )}
    </div>
  );
}

function SubmissionsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading submission review"
      className="grid grid-cols-1 items-stretch gap-6 md:h-[calc(100vh-220px)] md:min-h-[600px] md:grid-cols-12"
    >
      <div className="flex h-full min-h-[550px] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 pb-6 shadow-2xs sm:p-6 sm:pb-6 md:col-span-4 md:min-h-0">
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

      <div className="flex h-full min-h-[550px] flex-col rounded-2xl border border-slate-200 bg-white p-5 pb-6 shadow-2xs sm:p-6 sm:pb-6 md:col-span-8 md:min-h-0">
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
                <div className="flex h-4 items-center justify-between">
                  <div className={`h-3.5 animate-pulse rounded bg-slate-200/80 ${item === 0 ? "w-36" : "w-28"}`} />
                  {item === 1 ? <div className="h-4 w-20 animate-pulse rounded-full bg-slate-200/60" /> : null}
                </div>
                <div className="mt-2 h-32 w-full shrink-0 animate-pulse rounded-lg bg-slate-200/50" />
                <div className="my-3 min-h-[60px] flex-1 animate-pulse rounded-lg bg-slate-200/40" />
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
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("pending");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const [responseData, setResponseData] = useState<SubmissionsResponse>(EMPTY_RESPONSE);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({});
  const [savingSubmissionId, setSavingSubmissionId] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [gradeVerification, setGradeVerification] = useState<GradeVerification & { submissionId: string }>({
    submissionId: "",
    noFailing: false,
    noInc: false,
    noDropped: false,
    verifiedGwa: "",
  });
  const [deleteToast, setDeleteToast] = useState<{ message: string; isWarning: boolean } | null>(null);
  const [completedSemesterFilter, setCompletedSemesterFilter] = useState("all");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  useEffect(() => {
    if (!deleteToast) return;
    const timeout = window.setTimeout(() => setDeleteToast(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [deleteToast]);

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
      if (activeTab === "cleared") params.set("semester", completedSemesterFilter);

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
  }, [activeTab, page, pageSize, query, completedSemesterFilter, refreshToken]);

  const selectedSubmission =
    responseData.rows.find((submission) => submission.id === selectedSubmissionId) ?? null;
  const gradeReportApproved =
    selectedSubmission?.gradesStatus === "APPROVED" || selectedSubmission?.status === "APPROVED";
  const currentGradeVerification = gradeReportApproved
    ? {
        noFailing: true,
        noInc: true,
        noDropped: true,
        verifiedGwa: selectedSubmission.verifiedGwa === null ? "" : String(selectedSubmission.verifiedGwa),
      }
    : gradeVerification.submissionId === selectedSubmissionId
      ? gradeVerification
      : { noFailing: false, noInc: false, noDropped: false, verifiedGwa: "" };
  const isGradeVerificationComplete =
    currentGradeVerification.noFailing &&
    currentGradeVerification.noInc &&
    currentGradeVerification.noDropped;
  const verifiedGwa =
    currentGradeVerification.verifiedGwa;
  const draft = selectedSubmission
    ? reviewDrafts[selectedSubmission.id] ?? EMPTY_REVIEW_DRAFT
    : EMPTY_REVIEW_DRAFT;
  const isSaving = selectedSubmission !== null && savingSubmissionId === selectedSubmission.id;
  const completedSemesterOptions = ["all", ...responseData.semesters];
  const activeTabRecordLabel = {
    pending: "pending review",
    returned: "returned for edits",
    cleared: "fully cleared",
  }[activeTab];
  const pageRangeStart = responseData.totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageRangeEnd = Math.min(page * pageSize, responseData.totalCount);

  function changeTab(tab: TabType, selectedId: string | null = null) {
    setActiveTab(tab);
    setPage(1);
    setCompletedSemesterFilter("all");
    setSelectedSubmissionId(selectedId);
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

  function updateGradeVerification(updates: Partial<GradeVerification>) {
    if (!selectedSubmissionId) return;
    setGradeVerification((current) => ({
      submissionId: selectedSubmissionId,
      noFailing: current.submissionId === selectedSubmissionId ? current.noFailing : false,
      noInc: current.submissionId === selectedSubmissionId ? current.noInc : false,
      noDropped: current.submissionId === selectedSubmissionId ? current.noDropped : false,
      verifiedGwa: current.submissionId === selectedSubmissionId ? current.verifiedGwa : "",
      ...updates,
    }));
  }

  async function postDocumentReview(
    submission: SubmissionRow,
    docType: "coe" | "grades",
    action: "APPROVE" | "RETURN_FOR_UPDATE",
    notes: string,
    verification?: GradeVerification,
  ) {
    const response = await fetch(`/api/admin/submissions/${submission.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentType: docType,
        action,
        reviewNotes: notes,
        ...(verification
          ? {
            verifiedNoFailingGrades: verification.noFailing && verification.noInc && verification.noDropped,
            verifiedNoFailingGradesCheck: verification.noFailing,
            verifiedNoIncGrades: verification.noInc,
            verifiedNoDroppedSubjects: verification.noDropped,
            verifiedGwa: verification.verifiedGwa,
          }
          : {}),
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
  ): Promise<boolean> {
    const documentDraft = docType === "coe" ? draft.coe : draft.grades;
    if (action === "RETURN_FOR_UPDATE" && !documentDraft.notes.trim()) {
      setValidationError("Add review notes before returning a document for edits.");
      return false;
    }

    setSavingSubmissionId(submission.id);
    setActionError(null);
    setValidationError(null);
    setActionSuccess(null);
    try {
      const verification =
        docType === "grades" && action === "APPROVE"
          ? { ...currentGradeVerification }
          : undefined;
      await postDocumentReview(submission, docType, action, documentDraft.notes.trim(), verification);
      updateDraft(submission.id, { [docType]: { status: "PENDING", notes: "" } });
      setActionSuccess(
        action === "APPROVE"
          ? `${docType === "coe" ? "Certificate of Enrollment" : "Grade Report"} approved.`
          : `${docType === "coe" ? "Certificate of Enrollment" : "Grade Report"} returned for edits.`
      );
      if (action === "RETURN_FOR_UPDATE") {
        changeTab("returned");
      } else if (
        (docType === "coe" && submission.gradesStatus === "APPROVED") ||
        (docType === "grades" && submission.coeStatus === "APPROVED") ||
        submission.status === "APPROVED"
      ) {
        setActionSuccess("Submission package fully cleared.");
        changeTab("cleared", submission.id);
      } else {
        setIsLoading(true);
        setRefreshToken((current) => current + 1);
      }
      return true;
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to process review action.");
      return false;
    } finally {
      setSavingSubmissionId(null);
    }
  }

  async function submitPackageReview() {
    if (!selectedSubmission || isSaving) return;
    if (!isGradeVerificationComplete || parseVerifiedGwa(verifiedGwa) === null) {
      setValidationError("Verify the grade report and enter its GWA before approving the submission.");
      return;
    }

    setSavingSubmissionId(selectedSubmission.id);
    setActionError(null);
    setValidationError(null);
    setActionSuccess(null);
    try {
      await postDocumentReview(selectedSubmission, "coe", "APPROVE", "");
      if (selectedSubmission.gradeFileUrl) {
        await postDocumentReview(selectedSubmission, "grades", "APPROVE", "", {
          ...currentGradeVerification,
        });
      }
      setActionSuccess("Submission package fully cleared.");
      changeTab("cleared", selectedSubmission.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to process submission review.");
      setIsLoading(true);
      setRefreshToken((current) => current + 1);
    } finally {
      setSavingSubmissionId(null);
    }
  }

  async function deleteSelectedSubmission() {
    if (!selectedSubmission || isSaving) return;

    const submissionId = selectedSubmission.id;
    setSavingSubmissionId(submissionId);
    setActionError(null);
    setValidationError(null);
    setActionSuccess(null);
    try {
      const response = await fetch(`/api/admin/submissions/${submissionId}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to delete submission.");
      }

      setSelectedSubmissionId(null);
      setReviewDrafts((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[submissionId];
        return nextDrafts;
      });
      setDeleteToast({
        message: typeof payload.warning === "string" ? payload.warning : "Submission deleted.",
        isWarning: typeof payload.warning === "string",
      });
      setIsDeleteModalOpen(false);
      setIsLoading(true);
      setRefreshToken((current) => current + 1);
      window.dispatchEvent(new Event("admin-submissions-updated"));
      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to delete submission.");
    } finally {
      setSavingSubmissionId(null);
    }
  }

  return (
    <section className="w-full">
      {deleteToast ? (
        deleteToast.isWarning ? (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-6 right-6 z-50 flex max-w-sm items-start gap-3 rounded-xl border border-slate-200 border-l-4 border-l-amber-500 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-lg"
          >
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
            <span className="flex-1">{deleteToast.message}</span>
            <button
              type="button"
              onClick={() => setDeleteToast(null)}
              aria-label="Dismiss deletion notification"
              className="ml-1 text-slate-400 transition hover:text-slate-700"
            >
              ×
            </button>
          </div>
        ) : (
          <FloatingFeedback
            message={deleteToast.message}
            type="success"
            autoDismissMs={0}
            onDismiss={() => setDeleteToast(null)}
          />
        )
      ) : null}
      <div className="p-4 sm:p-5">
        <div className="flex h-10 items-center gap-4 overflow-x-auto">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <label className="relative block w-full max-w-sm shrink-0">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="Search grantee, school or semester..."
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                  setSelectedSubmissionId(null);
                  setIsLoading(true);
                }}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#0a1f33] focus:ring-2 focus:ring-[#0a1f33]/10"
              />
            </label>

            <label
              className={`flex h-10 w-[190px] shrink-0 items-center gap-2 text-xs text-slate-500 ${
                activeTab === "cleared" ? "" : "invisible pointer-events-none"
              }`}
              aria-hidden={activeTab !== "cleared"}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Semester</span>
              <select
                value={completedSemesterFilter}
                disabled={activeTab !== "cleared"}
                onChange={(event) => {
                  setCompletedSemesterFilter(event.target.value);
                  setPage(1);
                  setSelectedSubmissionId(null);
                  setIsLoading(true);
                }}
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700"
              >
                {completedSemesterOptions.map((semester) => (
                  <option key={semester} value={semester}>{semester === "all" ? "All Semesters" : semester}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => changeTab(tab.id)}
                aria-pressed={activeTab === tab.id}
                className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  activeTab === tab.id
                    ? "border-[#0a1f33] bg-[#0a1f33] text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
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
        <div className="mt-3 flex justify-end">
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
        {validationError ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{validationError}</p> : null}
        {actionError ? <FloatingFeedback message={actionError} type="error" onDismiss={() => setActionError(null)} /> : null}
        {actionSuccess ? <FloatingFeedback message={actionSuccess} type="success" autoDismissMs={0} onDismiss={() => setActionSuccess(null)} /> : null}

        {isLoading ? <SubmissionsSkeleton /> : (
        <div className="grid grid-cols-1 items-stretch gap-6 md:h-[calc(100vh-220px)] md:min-h-[600px] md:grid-cols-12">
          <aside className="flex min-h-[550px] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs md:col-span-4 md:h-full md:min-h-0">
            <div className="flex shrink-0 items-center gap-2.5 bg-slate-900 px-5 py-4 text-white">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-200 shadow-inner">
                <FileText className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xs font-bold tracking-wide text-white">{QUEUE_TITLES[activeTab]}</h2>
                <p className="text-[10px] font-medium tracking-wider text-slate-400">
                  {responseData.totalCount} {responseData.totalCount === 1 ? "package" : "packages"} {activeTabRecordLabel}
                </p>
                </div>
            </div>

            <div className="custom-scroll custom-scroll-visible min-h-0 flex-1 overflow-y-scroll p-4">
              <div className="space-y-2">
              {responseData.rows.length === 0 ? (
                <div className="px-3 py-12 text-center">
                  <FileText className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-700">No submissions found</p>
                  <p className="mt-1 text-xs text-slate-500">Try another status or search term.</p>
                </div>
              ) : responseData.rows.map((submission) => (
                <button
                  key={submission.id}
                  type="button"
                  onClick={() => {
                    setSelectedSubmissionId(submission.id);
                    setActionError(null);
                    setValidationError(null);
                    setActionSuccess(null);
                  }}
                  aria-current={selectedSubmissionId === submission.id ? "true" : undefined}
                  className={`w-full rounded-xl border p-4 text-left transition ${
                    selectedSubmissionId === submission.id
                      ? "border-[#0a1f33] bg-white shadow-sm ring-1 ring-[#0a1f33]"
                      : "border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-bold text-slate-900">{submission.grantee.user.fullName}</span>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getStatusClass(submission.status)}`}>
                      {getStatusLabel(submission.status)}
                    </span>
                  </div>
                  <p className="mt-2 truncate text-xs font-medium text-slate-600">{submission.semester}</p>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                    <span className="truncate">{normalizeSkeapSchoolName(submission.grantee.school)} · {submission.grantee.yearLevel}</span>
                    <time className="shrink-0">{formatDate(submission.submittedAt)}</time>
                  </div>
                </button>
              ))}
              </div>
            </div>

            <div className="mt-auto flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 p-4">
              <span className="text-xs font-medium text-slate-500">
                Showing {pageRangeStart}–{pageRangeEnd} of {responseData.totalCount} {activeTabRecordLabel}
              </span>
              {responseData.totalPages > 1 ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span>Rows</span>
                    <select
                      aria-label="Rows per page"
                      value={pageSize}
                      onChange={(event) => {
                        setPageSize(Number(event.target.value));
                        setPage(1);
                        setSelectedSubmissionId(null);
                        setIsLoading(true);
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-700"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isLoading || page <= 1}
                      onClick={() => { setPage((current) => current - 1); setIsLoading(true); }}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span className="whitespace-nowrap text-[10px] text-slate-500">{page} / {responseData.totalPages}</span>
                    <button
                      type="button"
                      disabled={isLoading || page >= responseData.totalPages}
                      onClick={() => { setPage((current) => current + 1); setIsLoading(true); }}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </aside>

          <section className="flex min-h-[320px] flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm md:col-span-8 md:h-full md:min-h-0">
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
                      ) : (
                        <>
                          {selectedSubmission.coeStatus === "APPROVED" &&
                          selectedSubmission.gradesStatus === "APPROVED" ? (
                            <button
                              type="button"
                              onClick={() => void submitPackageReview()}
                              disabled={
                                isSaving ||
                                !isGradeVerificationComplete ||
                                parseVerifiedGwa(verifiedGwa) === null
                              }
                              className="inline-flex items-center gap-2 rounded-xl bg-[#0a1f33] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#122e48] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Fully Clear
                            </button>
                          ) : null}
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsDeleteModalOpen(true)}
                        disabled={isSaving}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete Submission
                      </button>
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
                    <span>GPA {(selectedSubmission.generalAverage ?? selectedSubmission.grantee.generalAverage)?.toFixed(2) ?? "—"}</span>
                  </div>
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
                    ) : selectedSubmission.coeStatus === "APPROVED" || selectedSubmission.status === "APPROVED" ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                        Approved
                      </span>
                    ) : undefined}
                    reviewNotesValue={draft.coe.notes}
                    onNotesChange={(value) => updateDraft(selectedSubmission.id, {
                      coe: { ...draft.coe, notes: value },
                    })}
                    onApprove={() => void submitDocumentReview(selectedSubmission, "coe", "APPROVE")}
                    onReturn={() => submitDocumentReview(selectedSubmission, "coe", "RETURN_FOR_UPDATE")}
                    disabled={isSaving}
                    approved={selectedSubmission.coeStatus === "APPROVED" || selectedSubmission.status === "APPROVED"}
                  />

                  <DocumentCard
                    key={`${selectedSubmission.id}-grade`}
                    submissionId={selectedSubmission.id}
                    documentKind="grade"
                    title="Grade Report"
                    notesLabel="Grade Report Review Notes"
                    storedFilePath={selectedSubmission.gradeFileUrl}
                    badgeContent={selectedSubmission.gradeFileUrl ? (
                      <div className="flex items-center gap-2">
                        {gradeReportApproved ? (
                          <span className="inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2.5 text-[10px] font-bold text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                            {selectedSubmission.verifiedGwa !== null
                              ? `GWA: ${selectedSubmission.verifiedGwa.toFixed(2)} · Verified`
                              : "GWA Verified"}
                          </span>
                        ) : selectedSubmission.requiresStrictManualReview ? (
                          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-rose-100 px-2 py-1 text-[9px] font-bold text-rose-700">
                            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                            Flagged: Possible Failing Grade
                          </span>
                        ) : (
                          <OcrGwaBadge submissionId={selectedSubmission.id} />
                        )}
                      </div>
                    ) : undefined}
                    reviewNotesValue={draft.grades.notes}
                    onNotesChange={(value) => updateDraft(selectedSubmission.id, {
                      grades: { ...draft.grades, notes: value },
                    })}
                    onApprove={() => void submitDocumentReview(selectedSubmission, "grades", "APPROVE")}
                    onReturn={() => submitDocumentReview(selectedSubmission, "grades", "RETURN_FOR_UPDATE")}
                    disabled={isSaving || !selectedSubmission.gradeFileUrl}
                    approved={gradeReportApproved}
                    gradeVerification={currentGradeVerification}
                    verifiedGwa={verifiedGwa}
                    onGradeVerificationChange={(updates) => updateGradeVerification(updates)}
                    onVerifiedGwaChange={(value) => updateGradeVerification({ verifiedGwa: value })}
                  />
                </div>
              </>
            )}
          </section>
        </div>
        )}
      </div>
      {isDeleteModalOpen && selectedSubmission ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]"
          onClick={(event) => {
            if (event.target === event.currentTarget && !isSaving) {
              setIsDeleteModalOpen(false);
            }
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-submission-title"
            aria-describedby="delete-submission-description"
            className="w-full max-w-md space-y-5 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600">
                <Trash2 className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h2 id="delete-submission-title" className="text-base font-bold tracking-tight text-slate-900">
                  Delete Submission Record
                </h2>
                <p id="delete-submission-description" className="text-xs leading-relaxed text-slate-500">
                  Are you sure you want to delete {selectedSubmission.grantee.user.fullName}&apos;s submission?
                  This action is permanent and cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isSaving}
                className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void deleteSelectedSubmission()}
                disabled={isSaving}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition-all hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                {isSaving ? "Deleting..." : "Yes, Delete Record"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
