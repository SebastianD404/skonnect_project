"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { SubmissionStatus } from "@prisma/client";
import { ArrowUpRight, CheckCircle2, FileText, Loader2, Search, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { normalizeSkeapSchoolName } from "@/lib/skeap-school";

interface SubmissionRow {
  id: string;
  semester: string;
  gradeFileUrl: string;
  coeFileUrl: string;
  generalAverage: number | null;
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
};
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
  onReturn: () => void;
  disabled: boolean;
  approved: boolean;
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
}: DocumentCardProps) {
  const viewerUrl = `/api/submissions/${submissionId}/file?kind=${documentKind}`;
  const [previewType, setPreviewType] = useState<"pdf" | "image" | "unsupported" | "missing" | null>(null);

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
        return payload as { contentType: string | null; extension: string };
      })
      .then((metadata) => {
        if (!metadata) return;
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
        <h3 className="review-card__title">{title}</h3>
        {badgeContent ? <div className="shrink-0">{badgeContent}</div> : null}
      </div>

      <div className="review-card__preview">
        {previewType === "pdf" ? (
          <iframe
            src={`${viewerUrl}#toolbar=0&view=FitH`}
            className="h-full w-full border-0"
            title={title}
          />
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
            {storedFilePath && previewType !== "missing" ? (
              <a
                href={viewerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-[#0a1f33] px-4 py-1.5 text-[11px] font-bold text-white shadow-2xs transition-all hover:bg-[#122e48] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
              >
                View File
              </a>
            ) : null}
          </div>
        )}
      </div>

      <div className="review-card__notes">
        <label>{notesLabel}</label>
        <textarea
          rows={3}
          placeholder="Add feedback for the grantee..."
          value={reviewNotesValue}
          onChange={(event) => onNotesChange(event.target.value)}
          className="text-slate-900 placeholder:text-slate-400"
        />
      </div>

      <div className="review-card__actions">
        <button
          type="button"
          onClick={onReturn}
          disabled={disabled}
          className="review-button review-button--return"
        >
          <span>Return</span>
        </button>
        <button
          type="button"
          onClick={onApprove}
          disabled={disabled || approved}
          className="review-button review-button--approve"
        >
          <span>{approved ? "Approved" : "Approve"}</span>
        </button>
      </div>
    </article>
  );
}

function OcrGwaBadge({
  submissionId,
  submittedGwa,
}: {
  submissionId: string;
  submittedGwa: number | null;
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

  const gwa = submittedGwa ?? ocrGwa;
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
      ) : needsManualReview ? (
        <span className="flex items-center gap-1.5 font-semibold text-amber-700">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
          Manual Review
        </span>
      ) : (
        <span className="font-extrabold text-[#0a1f33]">
          {gwa?.toFixed(2)}
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
      className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-12"
    >
      <div className="min-h-[550px] overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/60 md:col-span-4">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <div className="space-y-2">
            <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
        <div className="space-y-2 p-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="space-y-3 rounded-xl border border-slate-200/80 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="h-4 w-2/5 animate-pulse rounded bg-slate-200" />
                <div className="h-5 w-24 animate-pulse rounded-full bg-slate-100" />
              </div>
              <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 md:col-span-8">
        <div className="space-y-3 border-b border-slate-200 bg-white p-4 sm:p-5">
          <div className="h-3 w-32 animate-pulse rounded bg-slate-100" />
          <div className="h-6 w-2/5 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="review-grid p-4 sm:p-5">
          {["COE", "Grade Report"].map((title) => (
            <div key={title} className="review-card">
              <div className="review-card__header">
                <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
              </div>
              <div className="review-card__preview">
                <div className="h-full w-full animate-pulse rounded-lg bg-slate-100" />
              </div>
              <div className="review-card__notes space-y-2">
                <div className="h-3 w-2/5 animate-pulse rounded bg-slate-200" />
                <div className="h-[84px] w-full animate-pulse rounded-xl bg-slate-100" />
              </div>
              <div className="review-card__actions">
                <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
                <div className="h-10 animate-pulse rounded-lg bg-slate-200" />
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
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [deleteToast, setDeleteToast] = useState<{ message: string; isWarning: boolean } | null>(null);
  const [completedSemesterFilter, setCompletedSemesterFilter] = useState("all");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  useEffect(() => {
    if (!deleteToast) return;
    const timeout = window.setTimeout(() => setDeleteToast(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [deleteToast]);

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

  function changeTab(tab: TabType) {
    setActiveTab(tab);
    setPage(1);
    setCompletedSemesterFilter("all");
    setSelectedSubmissionId(null);
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

  async function postDocumentReview(
    submission: SubmissionRow,
    docType: "coe" | "grades",
    action: "APPROVE" | "RETURN_FOR_UPDATE",
    notes: string,
  ) {
    const response = await fetch(`/api/admin/submissions/${submission.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentType: docType, action, reviewNotes: notes }),
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
  ) {
    const documentDraft = docType === "coe" ? draft.coe : draft.grades;
    if (action === "RETURN_FOR_UPDATE" && !documentDraft.notes.trim()) {
      setActionError("Add review notes before returning a document for edits.");
      return;
    }

    setSavingSubmissionId(submission.id);
    setActionError(null);
    setActionSuccess(null);
    try {
      await postDocumentReview(submission, docType, action, documentDraft.notes.trim());
      updateDraft(submission.id, { [docType]: { status: "PENDING", notes: "" } });
      setActionSuccess(
        action === "APPROVE"
          ? `${docType === "coe" ? "Certificate of Enrollment" : "Grade Report"} approved.`
          : `${docType === "coe" ? "Certificate of Enrollment" : "Grade Report"} returned for edits.`
      );
      setIsLoading(true);
      setRefreshToken((current) => current + 1);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to process review action.");
    } finally {
      setSavingSubmissionId(null);
    }
  }

  async function submitPackageReview(action: "APPROVE" | "RETURN_FOR_UPDATE") {
    if (!selectedSubmission || isSaving) return;
    const coeNotes = draft.coe.notes.trim();
    const gradeNotes = draft.grades.notes.trim();
    if (action === "RETURN_FOR_UPDATE" && !coeNotes && !gradeNotes) {
      setActionError("Add review notes to at least one document before returning this package for edits.");
      return;
    }

    setSavingSubmissionId(selectedSubmission.id);
    setActionError(null);
    setActionSuccess(null);
    try {
      if (action === "APPROVE") {
        await postDocumentReview(selectedSubmission, "coe", "APPROVE", "");
        if (selectedSubmission.gradeFileUrl) {
          await postDocumentReview(selectedSubmission, "grades", "APPROVE", "");
        }
        setActionSuccess("Submission package fully cleared.");
      } else {
        const combinedNotes = [
          coeNotes ? `Certificate of Enrollment: ${coeNotes}` : "",
          gradeNotes ? `Grade Report: ${gradeNotes}` : "",
        ].filter(Boolean).join("\n");
        await postDocumentReview(selectedSubmission, "coe", "RETURN_FOR_UPDATE", combinedNotes);
        if (selectedSubmission.gradeFileUrl) {
          await postDocumentReview(selectedSubmission, "grades", "RETURN_FOR_UPDATE", combinedNotes);
        }
        setActionSuccess("Submission package returned for edits.");
      }
      setIsLoading(true);
      setRefreshToken((current) => current + 1);
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
      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to delete submission.");
    } finally {
      setSavingSubmissionId(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
      {deleteToast ? (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-50 flex max-w-sm items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-lg ${
            deleteToast.isWarning ? "border-l-4 border-l-amber-500" : "border-l-4 border-l-emerald-500"
          }`}
        >
          <CheckCircle2
            className={`mt-0.5 h-5 w-5 shrink-0 ${deleteToast.isWarning ? "text-amber-500" : "text-emerald-500"}`}
            aria-hidden="true"
          />
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
      ) : null}
      <div className="space-y-4 border-b border-slate-200 bg-slate-50/70 p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <label className="relative block w-full xl:max-w-sm">
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
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#0a1f33] focus:ring-2 focus:ring-[#0a1f33]/10"
            />
          </label>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
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

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            Showing <strong className="text-slate-800">{pageRangeStart}–{pageRangeEnd}</strong> of{" "}
            <strong className="text-slate-800">{responseData.totalCount}</strong> {activeTabRecordLabel}
          </span>
          {activeTab === "cleared" ? (
            <label className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Semester</span>
              <select
                value={completedSemesterFilter}
                onChange={(event) => {
                  setCompletedSemesterFilter(event.target.value);
                  setPage(1);
                  setSelectedSubmissionId(null);
                  setIsLoading(true);
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                {completedSemesterOptions.map((semester) => (
                  <option key={semester} value={semester}>{semester === "all" ? "All Semesters" : semester}</option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 p-4 sm:p-5" aria-busy={isLoading}>
        {loadError ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</div> : null}
        {actionError ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{actionError}</div> : null}
        {actionSuccess ? (
          <div
            role="status"
            className="flex w-full max-w-2xl items-center justify-between gap-4 rounded-2xl border border-emerald-200/80 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 shadow-2xs"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
              <span>{actionSuccess}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionSuccess(null)}
              className="shrink-0 px-2 py-0.5 text-xs font-bold text-emerald-600 hover:text-emerald-800"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {isLoading ? <SubmissionsSkeleton /> : (
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-12">
          <aside className="flex min-h-[550px] flex-col rounded-2xl border border-slate-200/80 bg-slate-50/60 md:col-span-4">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">{QUEUE_TITLES[activeTab]}</h2>
                <p className="mt-0.5 text-[11px] text-slate-500">{responseData.totalCount} packages</p>
              </div>
            </div>

            <div className="space-y-2 p-3">
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

            {responseData.totalPages > 1 ? (
              <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white p-3">
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
          </aside>

          <section className="bg-transparent md:col-span-8">
            {!selectedSubmission ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <FileText className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-base font-bold text-slate-900">Select a grantee from the left to review their documents.</h2>
                <p className="mt-1 text-sm text-slate-500">Choose a package from the submission queue to begin.</p>
              </div>
            ) : (
              <>
                <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 p-4 backdrop-blur sm:p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0a1f33]">Submission review</p>
                      <h2 className="mt-1 truncate text-xl font-bold text-slate-950">{selectedSubmission.grantee.user.fullName}</h2>
                      <p className="mt-1 text-xs text-slate-500">
                        {selectedSubmission.grantee.user.email} · {normalizeSkeapSchoolName(selectedSubmission.grantee.school)} · {selectedSubmission.grantee.yearLevel}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {selectedSubmission.semester} · Submitted {formatDate(selectedSubmission.submittedAt)} · GPA{" "}
                        {(selectedSubmission.generalAverage ?? selectedSubmission.grantee.generalAverage)?.toFixed(2) ?? "—"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {selectedSubmission.status === "APPROVED" ? (
                        <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" />
                          Fully cleared
                        </span>
                      ) : (
                        <>
                          {selectedSubmission.coeStatus === "APPROVED" &&
                          selectedSubmission.gradesStatus === "APPROVED" ? (
                            <button
                              type="button"
                              onClick={() => void submitPackageReview("APPROVE")}
                              disabled={isSaving}
                              className="inline-flex items-center gap-2 rounded-xl bg-[#0a1f33] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#122e48] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Fully Clear
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void submitPackageReview("RETURN_FOR_UPDATE")}
                            disabled={isSaving}
                            className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-xs font-bold text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <ArrowUpRight className="h-4 w-4" />
                            Return for Edits
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsDeleteModalOpen(true)}
                        disabled={isSaving}
                        className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-xs font-bold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete Submission
                      </button>
                    </div>
                  </div>
                </header>

                <div className="review-grid p-4 sm:p-5">
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
                    onReturn={() => void submitDocumentReview(selectedSubmission, "coe", "RETURN_FOR_UPDATE")}
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
                        <OcrGwaBadge
                          submissionId={selectedSubmission.id}
                          submittedGwa={selectedSubmission.generalAverage ?? selectedSubmission.grantee.generalAverage ?? null}
                        />
                      </div>
                    ) : undefined}
                    reviewNotesValue={draft.grades.notes}
                    onNotesChange={(value) => updateDraft(selectedSubmission.id, {
                      grades: { ...draft.grades, notes: value },
                    })}
                    onApprove={() => void submitDocumentReview(selectedSubmission, "grades", "APPROVE")}
                    onReturn={() => void submitDocumentReview(selectedSubmission, "grades", "RETURN_FOR_UPDATE")}
                    disabled={isSaving || !selectedSubmission.gradeFileUrl}
                    approved={selectedSubmission.gradesStatus === "APPROVED" || selectedSubmission.status === "APPROVED"}
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
