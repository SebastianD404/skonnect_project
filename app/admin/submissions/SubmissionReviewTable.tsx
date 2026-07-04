"use client";

import { Fragment, useState } from "react";
import { ArrowUpRight, CheckCircle2, FileCheck2, FileText, Search } from "lucide-react";

interface SubmissionRow {
  id: string;
  semester: string;
  gradeFileUrl: string;
  coeFileUrl: string;
  generalAverage: number | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "RETURNED_FOR_EDIT";
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
  };
}

interface SubmissionsPhase {
  pendingCoe: SubmissionRow[];
  activeScholars: SubmissionRow[];
  pendingGrades: SubmissionRow[];
  completed: SubmissionRow[];
}

interface SubmissionReviewTableProps {
  submissions: SubmissionsPhase;
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

type TabType = "pending-coe" | "active-scholars" | "pending-grades" | "completed";

interface TabDef {
  id: TabType;
  label: string;
  description: string;
  rows: SubmissionRow[];
  badgeColor: string;
}

export default function SubmissionReviewTable({ submissions }: SubmissionReviewTableProps) {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("pending-coe");
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({});
  const [savingSubmissionId, setSavingSubmissionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const tabs: TabDef[] = [
    {
      id: "pending-coe",
      label: "Pending COE Review",
      description: "Phase 1: Awaiting enrollment verification",
      rows: submissions.pendingCoe,
      badgeColor: "bg-blue-100 text-blue-700",
    },
    {
      id: "active-scholars",
      label: "Awaiting Grades",
      description: "Phase 2: Awaiting end-of-semester submission",
      rows: submissions.activeScholars,
      badgeColor: "bg-emerald-100 text-emerald-700",
    },
    {
      id: "pending-grades",
      label: "Pending Grades Review",
      description: "Phase 2: Awaiting grade verification",
      rows: submissions.pendingGrades,
      badgeColor: "bg-amber-100 text-amber-700",
    },
    {
      id: "completed",
      label: "Fully Cleared",
      description: "Both phases completed",
      rows: submissions.completed,
      badgeColor: "bg-slate-100 text-slate-700",
    },
  ];

  const currentTab = tabs.find((t) => t.id === activeTab)!;
  const filtered = currentTab.rows.filter((submission) => {
    const search = query.toLowerCase();
    return (
      submission.semester.toLowerCase().includes(search) ||
      submission.grantee.user.fullName.toLowerCase().includes(search) ||
      submission.grantee.school.toLowerCase().includes(search) ||
      submission.grantee.yearLevel.toLowerCase().includes(search)
    );
  });

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
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-[#0F3D5C]">Submissions Pipeline</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">Confirm academic documents</h2>
        </div>

        <label className="relative block w-full max-w-sm">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search by grantee, school or semester"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-full border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm text-slate-700 outline-none transition focus:border-[#0F3D5C] focus:ring-2 focus:ring-[#0F3D5C]/20"
          />
        </label>
      </div>

      {/* Tab Navigation */}
      <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setQuery("");
            }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab.id
                ? "border-b-2 border-[#0F3D5C] text-[#0F3D5C] bg-slate-50"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {tab.label}
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${tab.badgeColor}`}>
              {tab.rows.length}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto">
        {actionError ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{actionError}</div>
        ) : null}
        {actionSuccess ? (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{actionSuccess}</div>
        ) : null}
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="whitespace-nowrap px-4 py-4 text-left font-semibold">Grantee</th>
              <th className="whitespace-nowrap px-4 py-4 text-left font-semibold">Semester</th>
              <th className="whitespace-nowrap px-4 py-4 text-left font-semibold">School / Level</th>
              <th className="whitespace-nowrap px-4 py-4 text-left font-semibold">Average</th>
              <th className="whitespace-nowrap px-4 py-4 text-left font-semibold">Submitted</th>
              <th className="px-4 py-4 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-sm text-slate-500">
                  No pending submissions match that filter.
                </td>
              </tr>
            ) : (
              filtered.map((submission) => {
                const isExpanded = expandedSubmission === submission.id;
                const draft = reviewDrafts[submission.id] ?? EMPTY_REVIEW_DRAFT;
                const isSaving = savingSubmissionId === submission.id;
                return (
                  <Fragment key={submission.id}>
                    <tr className="hover:bg-slate-50 transition">
                      <td className="px-4 py-4">
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-900">{submission.grantee.user.fullName}</div>
                          <div className="truncate text-xs text-slate-500">{submission.grantee.user.email}</div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-700">{submission.semester}</td>
                      <td className="px-4 py-4 text-slate-700">
                        <div>{submission.grantee.school}</div>
                        <div className="text-xs text-slate-500">{submission.grantee.yearLevel}</div>
                      </td>
                      <td className="px-4 py-4 text-slate-700">{submission.generalAverage?.toFixed(2) ?? "—"}</td>
                      <td className="px-4 py-4 text-slate-700">{new Date(submission.submittedAt).toLocaleDateString()}</td>
                      <td className="px-4 py-4 text-right">
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
                        <td colSpan={6} className="px-4 py-6">
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
    </div>
  );
}
