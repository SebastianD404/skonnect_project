"use client";

import { Fragment, useEffect, useState } from "react";
import type { SubmissionStatus } from "@prisma/client";
import { ArrowUpRight, CheckCircle2, FileCheck2, FileText, Loader2, Search } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface SubmissionRow {
  id: string;
  semester: string;
  gradeFileUrl: string;
  coeFileUrl: string;
  generalAverage: number | null;
  gradeRows?: Array<{ subject: string; grade: number }> | null;
  status: SubmissionStatus;
  reviewNotes: string | null;
  flaggedFields?: string[];
  submittedAt: string;
  grantee: {
    user: {
      fullName: string;
      email: string;
    };
    school: string;
    yearLevel: string;
    generalAverage?: number | null;
  };
}

type TabType = "pending-coe" | "active-scholars" | "pending-grades" | "completed";

interface SubmissionsResponse {
  rows: SubmissionRow[];
  counts: Record<TabType, number>;
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  semesters: string[];
}

type DocumentReview = {
  status: "PENDING" | "APPROVED" | "RETURN_FOR_UPDATE";
  notes: string;
};

type ReviewDraft = {
  coe: DocumentReview;
  grades: DocumentReview;
};

const EMPTY_REVIEW_DRAFT: ReviewDraft = {
  coe: { status: "PENDING", notes: "" },
  grades: { status: "PENDING", notes: "" },
};

interface TabDef {
  id: TabType;
  label: string;
  description: string;
}

const EMPTY_RESPONSE: SubmissionsResponse = {
  rows: [],
  counts: { "pending-coe": 0, "active-scholars": 0, "pending-grades": 0, completed: 0 },
  totalCount: 0,
  page: 1,
  pageSize: 10,
  totalPages: 1,
  semesters: [],
};

export default function SubmissionReviewTable() {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("pending-coe");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [responseData, setResponseData] = useState<SubmissionsResponse>(EMPTY_RESPONSE);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({});
  const [savingSubmissionId, setSavingSubmissionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [completedSemesterFilter, setCompletedSemesterFilter] = useState<string>("all");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams({
        status: activeTab,
        page: String(page),
        limit: String(pageSize),
        search: query.trim(),
      });
      if (activeTab === "completed") params.set("semester", completedSemesterFilter);

      try {
        const result = await fetch(`/api/admin/submissions?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await result.json().catch(() => ({}));
        if (!result.ok) throw new Error(body?.error || "Unable to load submissions.");
        setResponseData(body as SubmissionsResponse);
        setLoadError(null);
        setPage(body.page ?? page);
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
  }, [activeTab, page, pageSize, query, completedSemesterFilter]);

  const tabs: TabDef[] = [
    {
      id: "pending-coe",
      label: "Pending COE Review",
      description: "Phase 1: Awaiting enrollment verification",
    },
    {
      id: "active-scholars",
      label: "Awaiting Grades",
      description: "Phase 2: Awaiting end-of-semester submission",
    },
    {
      id: "pending-grades",
      label: "Pending Grades Review",
      description: "Phase 2: Awaiting grade verification",
    },
    {
      id: "completed",
      label: "Fully Cleared",
      description: "Both phases completed",
    },
  ];

  const rows = responseData.rows;
  const completedSemesterOptions = ["all", ...responseData.semesters];
  const pageRangeStart = responseData.totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageRangeEnd = Math.min(page * pageSize, responseData.totalCount);
  const activeTabRecordLabel = {
    "pending-coe": "pending",
    "active-scholars": "awaiting grades",
    "pending-grades": "pending grade review",
    completed: "fully cleared",
  }[activeTab];

  function changeTab(tab: TabType) {
    setActiveTab(tab);
    setPage(1);
    setCompletedSemesterFilter("all");
    setExpandedSubmission(null);
    setIsLoading(true);
  }

  const getDraft = (submissionId: string): ReviewDraft => {
    return reviewDrafts[submissionId] ?? EMPTY_REVIEW_DRAFT;
  };

  const updateDraft = (submissionId: string, updates: Partial<ReviewDraft>) => {
    setReviewDrafts((current) => ({
      ...current,
      [submissionId]: {
        ...(current[submissionId] ?? EMPTY_REVIEW_DRAFT),
        ...updates,
      },
    }));
  };



  async function submitDocumentReview(
    submission: SubmissionRow,
    docType: "coe" | "grades",
    action: "APPROVE" | "RETURN_FOR_UPDATE"
  ) {
    const draft = getDraft(submission.id);
    const docReview = docType === "coe" ? draft.coe : draft.grades;

    setSavingSubmissionId(submission.id);
    setActionError(null);
    setActionSuccess(null);

    try {
      const response = await fetch(`/api/admin/submissions/${submission.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType: docType,
          action,
          reviewNotes: docReview.notes,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to update document review status");
      }

      // Clear the notes for this document after successful review
      updateDraft(submission.id, {
        [docType]: { status: "PENDING", notes: "" },
      });

      setActionSuccess(
        action === "APPROVE"
          ? `${docType === "coe" ? "Certificate of Enrollment" : "Grade Report"} approved.`
          : `${docType === "coe" ? "Certificate of Enrollment" : "Grade Report"} returned for correction.`
      );

      // Refresh page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to process review action.");
    } finally {
      setSavingSubmissionId(null);
    }
  }

  return (
    <div className="flex h-fit flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-100 bg-slate-50/50 p-4 sm:p-5 xl:flex-row xl:items-center">
        <label className="relative block w-full xl:w-80">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search by grantee, school or semester..."
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
              setIsLoading(true);
            }}
            className="w-full rounded-full border border-slate-200 bg-white py-2 pl-10 pr-4 text-xs text-slate-700 shadow-sm outline-none placeholder:text-slate-400 focus:border-cyan-500"
          />
        </label>

        <div className="flex w-full shrink-0 items-center justify-start gap-1.5 overflow-x-auto pb-1 xl:w-auto xl:justify-end xl:pb-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => changeTab(tab.id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeTab === tab.id
                    ? "border border-slate-200 bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${activeTab === tab.id ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                  {responseData.counts[tab.id]}
                </span>
              </button>
            ))}
        </div>
      </div>

      <div className="flex h-[52px] items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5">
        <span className="text-xs font-medium text-slate-500">
          Showing <span className="font-bold text-slate-700">{responseData.totalCount}</span> {activeTabRecordLabel} records
        </span>
        {activeTab === "completed" && (
          <div className="flex items-center gap-2">
            <label htmlFor="completed-semester" className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Filter Semester:</label>
            <select
              id="completed-semester"
              value={completedSemesterFilter}
              onChange={(event) => {
                setCompletedSemesterFilter(event.target.value);
                setPage(1);
                setIsLoading(true);
              }}
              className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm outline-none focus:border-cyan-500"
            >
              {completedSemesterOptions.map((opt) => (
                <option key={opt} value={opt}>{opt === "all" ? "All Semesters" : opt}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="w-full" aria-busy={isLoading}>
        {loadError ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</div>
        ) : null}
        {actionError ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{actionError}</div>
        ) : null}
        {actionSuccess ? (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{actionSuccess}</div>
        ) : null}
        <div className={`relative w-full overflow-x-auto ${isLoading ? "min-h-[250px]" : ""}`}>
          {isLoading ? (
            <div
              role="status"
              aria-live="polite"
              className="absolute inset-x-0 bottom-0 top-[50px] z-20 flex items-center justify-center bg-white/60 backdrop-blur-[1.5px] transition-all duration-300"
            >
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-cyan-600" />
                <span className="text-xs font-semibold text-slate-600">Loading submissions...</span>
              </div>
            </div>
          ) : null}
        <table className="w-full table-fixed border-collapse whitespace-nowrap text-left text-sm divide-y divide-slate-200">
          <thead className="relative z-30 bg-gradient-to-r from-slate-900 to-cyan-900 text-cyan-50 text-[11px] font-bold tracking-widest uppercase">
            <tr className="border-b border-slate-800">
              <th className="w-[25%] truncate px-6 py-4 text-left">Grantee</th>
              <th className="w-[15%] truncate px-6 py-4 text-left">Semester</th>
              <th className="w-[25%] truncate px-6 py-4 text-left">School / Level</th>
              <th className="w-[10%] truncate px-6 py-4 text-left">Average</th>
              <th className="w-[15%] truncate px-6 py-4 text-left">Submitted</th>
              <th className="w-[10%] truncate px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className={`divide-y divide-slate-200 bg-white transition-opacity duration-300 ${isLoading ? "pointer-events-none opacity-40" : "opacity-100"}`}>
            {!isLoading && rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-full border border-slate-100 bg-slate-50 text-slate-400">
                      <FileText className="h-4 w-4" />
                    </div>
                    <p className="text-xs font-semibold text-slate-700">No submissions match the selected filters.</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">Try switching tabs or resetting your search criteria.</p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((submission) => {
                const isExpanded = expandedSubmission === submission.id;
                const draft = reviewDrafts[submission.id] ?? EMPTY_REVIEW_DRAFT;
                const isSaving = savingSubmissionId === submission.id;
                return (
                  <Fragment key={submission.id}>
                    <tr className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4">
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-900">{submission.grantee.user.fullName}</div>
                          <div className="truncate text-xs text-slate-500">{submission.grantee.user.email}</div>
                        </div>
                      </td>
                      <td className="truncate px-6 py-4 text-slate-700">{submission.semester}</td>
                      <td className="px-6 py-4 text-slate-700">
                        <div className="truncate">{submission.grantee.school}</div>
                        <div className="truncate text-xs text-slate-500">{submission.grantee.yearLevel}</div>
                      </td>
                      <td className="truncate px-6 py-4 text-slate-700">{(submission.generalAverage ?? submission.grantee.generalAverage)?.toFixed(2) ?? "—"}</td>
                      <td className="truncate px-6 py-4 text-slate-700">{formatDate(submission.submittedAt)}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setExpandedSubmission(isExpanded ? null : submission.id)}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-700 transition hover:border-slate-300 hover:bg-slate-200"
                        >
                          {isExpanded ? "Hide" : "View"}
                          <FileText className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr className="bg-slate-50">
                        <td colSpan={6} className="px-6 py-6">
                          <div className="space-y-6">
                            {/* CERTIFICATE OF ENROLLMENT REVIEW */}
                            {(() => {
                              const coeIsApproved =
                                activeTab !== "pending-coe" && !draft.coe.notes && !(submission.flaggedFields ?? []).includes("COE");
                              const coeNeedsCorrectionReview = (submission.flaggedFields ?? []).includes("COE");

                              return (
                                <div className={`rounded-2xl border p-6 transition-all ${coeIsApproved ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                      <div
                                        className={`mt-1 flex h-10 w-10 items-center justify-center rounded-lg ${
                                          coeIsApproved ? "bg-emerald-100 text-emerald-600" : "bg-slate-50 text-[#0F3D5C]"
                                        }`}
                                      >
                                        <FileCheck2 className="h-5 w-5" />
                                      </div>
                                      <div>
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Certificate of Enrollment</h3>
                                        <a
                                          href={submission.coeFileUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-[#0B192C] transition-all hover:underline"
                                        >
                                          View COE Document
                                        </a>
                                      </div>
                                    </div>
                                    {coeIsApproved && (
                                      <span className="whitespace-nowrap rounded-full bg-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
                                        ✓ Verified
                                      </span>
                                    )}
                                    {coeNeedsCorrectionReview && (
                                      <span className="whitespace-nowrap rounded-full bg-amber-200 px-3 py-1 text-xs font-bold text-amber-700">
                                        ⚠ Needs Correction
                                      </span>
                                    )}
                                  </div>

                                  {!coeIsApproved && (
                                    <div className="mt-4 space-y-3">
                                      <label className="block">
                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Review Notes</span>
                                        <textarea
                                          rows={3}
                                          value={draft.coe.notes}
                                          onChange={(e) =>
                                            updateDraft(submission.id, {
                                              coe: { ...draft.coe, notes: e.target.value },
                                            })
                                          }
                                          className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-slate-800"
                                          placeholder="Enter feedback or guidance for the grantee..."
                                        />
                                      </label>
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() => submitDocumentReview(submission, "coe", "APPROVE")}
                                          disabled={isSaving}
                                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold tracking-tight text-white transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          <CheckCircle2 className="h-4 w-4" />
                                          {isSaving ? "Approving..." : "Approve COE"}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => submitDocumentReview(submission, "coe", "RETURN_FOR_UPDATE")}
                                          disabled={isSaving}
                                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-semibold tracking-tight text-amber-700 transition-all hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          <ArrowUpRight className="h-4 w-4" />
                                          {isSaving ? "Returning..." : "Return for Correction"}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* GRADE REPORT REVIEW */}
                            {submission.gradeFileUrl ? (
                              (() => {
                                const gradesIsApproved =
                                  activeTab === "completed" && !draft.grades.notes && !(submission.flaggedFields ?? []).includes("GRADE_REPORT");
                                const gradesNeedsCorrectionReview = (submission.flaggedFields ?? []).includes("GRADE_REPORT");

                                return (
                                  <div
                                    className={`rounded-2xl border p-6 transition-all ${gradesIsApproved ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}
                                  >
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex items-start gap-3">
                                        <div
                                          className={`mt-1 flex h-10 w-10 items-center justify-center rounded-lg ${
                                            gradesIsApproved ? "bg-emerald-100 text-emerald-600" : "bg-slate-50 text-[#0F3D5C]"
                                          }`}
                                        >
                                          <FileText className="h-5 w-5" />
                                        </div>
                                        <div>
                                          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Grade Report</h3>
                                          <a
                                            href={submission.gradeFileUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-[#0B192C] transition-all hover:underline"
                                          >
                                            View Grades Document
                                          </a>
                                        </div>
                                      </div>
                                      {gradesIsApproved && (
                                        <span className="whitespace-nowrap rounded-full bg-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
                                          ✓ Verified
                                        </span>
                                      )}
                                      {gradesNeedsCorrectionReview && (
                                        <span className="whitespace-nowrap rounded-full bg-amber-200 px-3 py-1 text-xs font-bold text-amber-700">
                                          ⚠ Needs Correction
                                        </span>
                                      )}
                                    </div>

                                    {!gradesIsApproved && (
                                      <div className="mt-4 space-y-3">
                                        <label className="block">
                                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Review Notes</span>
                                          <textarea
                                            rows={3}
                                            value={draft.grades.notes}
                                            onChange={(e) =>
                                              updateDraft(submission.id, {
                                                grades: { ...draft.grades, notes: e.target.value },
                                              })
                                            }
                                            className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-slate-800"
                                            placeholder="Enter feedback or guidance for the grantee..."
                                          />
                                        </label>
                                        <div className="flex gap-2">
                                          <button
                                            type="button"
                                            onClick={() => submitDocumentReview(submission, "grades", "APPROVE")}
                                            disabled={isSaving}
                                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold tracking-tight text-white transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                          >
                                            <CheckCircle2 className="h-4 w-4" />
                                            {isSaving ? "Approving..." : "Approve Grades"}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => submitDocumentReview(submission, "grades", "RETURN_FOR_UPDATE")}
                                            disabled={isSaving}
                                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-semibold tracking-tight text-amber-700 transition-all hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                                          >
                                            <ArrowUpRight className="h-4 w-4" />
                                            {isSaving ? "Returning..." : "Return for Correction"}
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()
                            ) : (
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-400">
                                    <FileText className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Grade Report</h3>
                                    <span className="mt-1 inline-flex items-center rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-600">
                                      Phase 2: Awaiting end-of-semester submission
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-xs font-medium text-slate-500">
              {responseData.totalCount === 0 ? (
                <span>No submissions found</span>
              ) : responseData.totalCount <= pageSize || responseData.totalPages <= 1 ? (
                <span><span className="font-bold text-slate-700">{responseData.totalCount}</span> total submissions</span>
              ) : (
                <span>
                  Showing <span className="font-bold text-slate-700">{pageRangeStart}–{pageRangeEnd}</span> of{" "}
                  <span className="font-bold text-slate-700">{responseData.totalCount}</span>
                </span>
              )}
            </span>
            <label className="flex items-center gap-1.5 border-l border-slate-200 pl-3 text-[11px] font-medium text-slate-400">
              <span>Show</span>
              <select
                aria-label="Rows per page"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                  setIsLoading(true);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-sm outline-none transition-all focus:ring-2 focus:ring-cyan-600"
              >
                <option value={10}>10 rows</option>
                <option value={20}>20 rows</option>
                <option value={50}>50 rows</option>
              </select>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isLoading || page <= 1}
              onClick={() => {
                setPage((currentPage) => Math.max(1, currentPage - 1));
                setIsLoading(true);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="min-w-24 text-center text-xs font-semibold text-slate-600">
              Page {responseData.totalCount === 0 ? 0 : page} of {responseData.totalCount === 0 ? 0 : responseData.totalPages}
            </span>
            <button
              type="button"
              disabled={isLoading || page >= responseData.totalPages || responseData.totalCount === 0}
              onClick={() => {
                setPage((currentPage) => Math.min(responseData.totalPages, currentPage + 1));
                setIsLoading(true);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
