"use client";

import { useState } from "react";
import { CheckCircle2, FileCheck2, FileText, FileX2, Search, X } from "lucide-react";

interface SubmissionRow {
  id: string;
  semester: string;
  gradeFileUrl: string;
  coeFileUrl: string;
  generalAverage: number | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewNotes: string | null;
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

export default function SubmissionReviewTable({ submissions }: SubmissionReviewTableProps) {
  const [query, setQuery] = useState("");
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null);

  const filtered = submissions.filter((submission) => {
    const search = query.toLowerCase();
    return (
      submission.semester.toLowerCase().includes(search) ||
      submission.grantee.user.fullName.toLowerCase().includes(search) ||
      submission.grantee.school.toLowerCase().includes(search) ||
      submission.grantee.yearLevel.toLowerCase().includes(search)
    );
  });

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
                return (
                  <>
                    <tr key={submission.id} className="hover:bg-slate-50 transition">
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
                          <div className="grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
                            <div className="space-y-4">
                              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <div className="text-xs uppercase tracking-[0.28em] text-[#0F3D5C]">Certificate of Enrollment</div>
                                    <a
                                      href={submission.coeFileUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-[#0F3D5C] underline"
                                    >
                                      View COE
                                    </a>
                                  </div>
                                  <FileCheck2 className="h-5 w-5 text-emerald-600" />
                                </div>
                              </div>

                              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <div className="text-xs uppercase tracking-[0.28em] text-[#0F3D5C]">Grade report</div>
                                    <a
                                      href={submission.gradeFileUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-[#0F3D5C] underline"
                                    >
                                      View grades
                                    </a>
                                  </div>
                                  <FileCheck2 className="h-5 w-5 text-emerald-600" />
                                </div>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-xs uppercase tracking-[0.28em] text-[#0F3D5C]">Review notes</p>
                                    <p className="mt-2 text-sm text-slate-500">Add comments before approving or returning.</p>
                                  </div>
                                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">Pending</span>
                                </div>
                                <textarea
                                  rows={4}
                                  className="mt-4 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#0F3D5C] focus:ring-2 focus:ring-[#0F3D5C]/20"
                                  placeholder="Enter review notes..."
                                />
                              </div>

                              <div className="flex flex-col gap-3 sm:flex-row">
                                <button
                                  type="button"
                                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                                >
                                  <X className="h-4 w-4" />
                                  Reject
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#0F3D5C] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0D2E47]"
                                >
                                  <FileX2 className="h-4 w-4" />
                                  Return for update
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
