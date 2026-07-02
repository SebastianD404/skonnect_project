"use client";

import { Fragment, useRef, useState } from "react";
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

interface SubmissionReviewTableProps {
  submissions: SubmissionRow[];
}

type ReviewDraft = {
  coeNeedsRevision: boolean;
  gradeNeedsRevision: boolean;
  notes: string;
};

const EMPTY_REVIEW_DRAFT: ReviewDraft = {
  coeNeedsRevision: false,
  gradeNeedsRevision: false,
  notes: "",
};

export default function SubmissionReviewTable({ submissions }: SubmissionReviewTableProps) {
  const [rows, setRows] = useState<SubmissionRow[]>(submissions);
  const [query, setQuery] = useState("");
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({});
  const [savingSubmissionId, setSavingSubmissionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const notesRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const filtered = rows.filter((submission) => {
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

  const focusNotes = (submissionId: string) => {
    setTimeout(() => {
      notesRefs.current[submissionId]?.focus();
    }, 0);
  };

  async function submitReview(submission: SubmissionRow, action: "APPROVE" | "RETURN_FOR_UPDATE") {
    const draft = getDraft(submission.id);
    const flaggedFields = [
      draft.coeNeedsRevision ? "COE" : null,
      draft.gradeNeedsRevision ? "GRADE_REPORT" : null,
    ].filter((value): value is string => Boolean(value));

    setSavingSubmissionId(submission.id);
    setActionError(null);
    setActionSuccess(null);

    try {
      const response = await fetch(`/api/admin/submissions/${submission.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reviewNotes: draft.notes,
          flaggedFields,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to update submission review status");
      }

      setRows((current) => current.filter((item) => item.id !== submission.id));
      setExpandedSubmission((current) => (current === submission.id ? null : current));
      setActionSuccess(
        action === "APPROVE"
          ? "Submission approved and removed from the pending queue."
          : "Submission returned for update with targeted correction flags."
      );
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
          <p className="text-sm uppercase tracking-[0.3em] text-[#0F3D5C]">Pending submissions</p>
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
                const draft =
                  reviewDrafts[submission.id] ??
                  {
                    ...EMPTY_REVIEW_DRAFT,
                    notes: submission.reviewNotes ?? "",
                    coeNeedsRevision: (submission.flaggedFields ?? []).includes("COE"),
                    gradeNeedsRevision: (submission.flaggedFields ?? []).includes("GRADE_REPORT"),
                  };
                const hasFlaggedDocument = draft.coeNeedsRevision || draft.gradeNeedsRevision;
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
                        <td colSpan={6} className="px-4 py-5">
                          <div className="mt-1 grid grid-cols-1 gap-6 lg:grid-cols-3">
                            <div className="space-y-4 lg:col-span-2">
                              <div className={`flex items-center justify-between gap-4 rounded-2xl border bg-white p-5 transition-all duration-200 ${draft.coeNeedsRevision ? "border-amber-300 bg-amber-50/20" : "border-slate-200"}`}>
                                <div className="flex min-w-0 items-center gap-3">
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[#0F3D5C]">
                                    <FileCheck2 className="h-4.5 w-4.5" />
                                  </div>
                                  <div className="min-w-0">
                                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Certificate of Enrollment</span>
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
                                <label className="flex shrink-0 cursor-pointer select-none items-center gap-2 text-xs font-medium text-slate-500">
                                  <input
                                    type="checkbox"
                                    checked={draft.coeNeedsRevision}
                                    onChange={(event) => {
                                      const checked = event.target.checked;
                                      updateDraft(submission.id, { coeNeedsRevision: checked });
                                      if (checked) focusNotes(submission.id);
                                    }}
                                    className="h-3.5 w-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                  />
                                  <span>Flag for correction</span>
                                </label>
                              </div>

                              <div className={`flex items-center justify-between gap-4 rounded-2xl border bg-white p-5 transition-all duration-200 ${draft.gradeNeedsRevision ? "border-amber-300 bg-amber-50/20" : "border-slate-200"}`}>
                                <div className="flex min-w-0 items-center gap-3">
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[#0F3D5C]">
                                    <FileText className="h-4.5 w-4.5" />
                                  </div>
                                  <div className="min-w-0">
                                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Grade Report</span>
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
                                <label className="flex shrink-0 cursor-pointer select-none items-center gap-2 text-xs font-medium text-slate-500">
                                  <input
                                    type="checkbox"
                                    checked={draft.gradeNeedsRevision}
                                    onChange={(event) => {
                                      const checked = event.target.checked;
                                      updateDraft(submission.id, { gradeNeedsRevision: checked });
                                      if (checked) focusNotes(submission.id);
                                    }}
                                    className="h-3.5 w-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                  />
                                  <span>Flag for correction</span>
                                </label>
                              </div>
                            </div>

                            <div className="flex h-full flex-col justify-between space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Review Notes</span>
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${hasFlaggedDocument ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                                    {hasFlaggedDocument ? "Correction flagged" : "Pending"}
                                  </span>
                                </div>
                                <textarea
                                  ref={(element) => {
                                    notesRefs.current[submission.id] = element;
                                  }}
                                  rows={5}
                                  value={draft.notes}
                                  onChange={(event) => updateDraft(submission.id, { notes: event.target.value })}
                                  className="h-32 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-slate-800"
                                  placeholder="Provide clear guidance for document updates or internal verification notes..."
                                />
                              </div>

                              <div className="flex w-full items-center gap-2 border-t border-slate-100 pt-3">
                                {hasFlaggedDocument ? (
                                  <button
                                    type="button"
                                    onClick={() => submitReview(submission, "RETURN_FOR_UPDATE")}
                                    disabled={isSaving}
                                    className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold tracking-tight text-amber-700 transition-all duration-150 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                    {isSaving ? "Returning..." : "Return for Update"}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => submitReview(submission, "APPROVE")}
                                    disabled={isSaving}
                                    className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-[#0B192C] px-4 py-2 text-xs font-semibold tracking-tight text-white transition-all duration-150 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    {isSaving ? "Approving..." : "Approve Submission"}
                                  </button>
                                )}
                              </div>
                            </div>
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
