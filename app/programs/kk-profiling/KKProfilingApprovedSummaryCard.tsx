"use client";

import { CheckCircle2 } from "lucide-react";

type ApprovedSummaryCardProps = {
  fullName: string;
  email: string;
  contactNumber: string;
  age: number;
  approvalDate?: string;
  submittedDate?: string;
  onViewApplication: () => void;
};

export default function KKProfilingApprovedSummaryCard({
  fullName,
  email,
  contactNumber,
  age,
  approvalDate,
  submittedDate,
  onViewApplication,
}: ApprovedSummaryCardProps) {
  const formattedApprovalDate = approvalDate
    ? new Date(approvalDate).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Recently approved";

  const formattedSubmittedDate = submittedDate
    ? new Date(submittedDate).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Unknown";

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-full">
      {/* Header with Icon */}
      <div className="mb-4">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Application Approved</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">Your KK Profiling registration has been successfully verified and approved by Barangay Pico.</p>
      </div>

      {/* Status Badge */}
      <div className="mb-4 text-xs text-slate-500">Approved {formattedApprovalDate}</div>

      {/* Quick Info Cards */}
      <dl className="my-4 grid grid-cols-2 gap-4 border-y border-slate-100 py-4 text-sm">
        <div className="col-span-2"><dt className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Registered name</dt><dd className="mt-1 font-medium text-slate-900">{fullName}</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Email</dt><dd className="mt-1 break-all text-slate-700">{email}</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Contact</dt><dd className="mt-1 text-slate-700">{contactNumber}</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Age</dt><dd className="mt-1 text-slate-700">{age} years old</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Submitted</dt><dd className="mt-1 text-slate-700">{formattedSubmittedDate}</dd></div>
      </dl>

      {/* Info Box */}
      <p className="mb-6 text-sm leading-relaxed text-slate-500">
        Your complete application details are stored in our system. You can view and download your full application below.
      </p>

      {/* Action Button */}
      <button
        type="button"
        onClick={onViewApplication}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800"
      >
        View Complete Application
      </button>

    </div>
  );
}
