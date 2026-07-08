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
    <div className="rounded-[2rem] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-50/50 p-8 shadow-sm">
      {/* Header with Icon */}
      <div className="flex items-start gap-4 mb-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-emerald-900">Application Approved</h2>
          <p className="mt-1 text-sm text-emerald-700 font-medium">Your KK Profiling registration has been successfully approved</p>
        </div>
      </div>

      {/* Status Badge */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-600"></span>
          Approved
        </span>
        <span className="text-xs font-medium text-slate-600">
          {formattedApprovalDate}
        </span>
      </div>

      {/* Quick Info Cards */}
      <div className="grid gap-3 mb-6">
        <div className="rounded-2xl bg-white/70 border border-white p-4">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500 font-semibold">Registered Name</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{fullName}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-white/70 border border-white p-4">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500 font-semibold">Email</p>
            <p className="mt-2 text-sm font-medium text-slate-700 break-all">{email}</p>
          </div>
          <div className="rounded-2xl bg-white/70 border border-white p-4">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500 font-semibold">Contact</p>
            <p className="mt-2 text-sm font-medium text-slate-700">{contactNumber}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-white/70 border border-white p-4">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500 font-semibold">Age</p>
            <p className="mt-2 text-sm font-medium text-slate-700">{age} years old</p>
          </div>
          <div className="rounded-2xl bg-white/70 border border-white p-4">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500 font-semibold">Submitted</p>
            <p className="mt-2 text-sm font-medium text-slate-700">{formattedSubmittedDate}</p>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="rounded-2xl bg-white/60 border border-emerald-100 p-5 mb-6">
        <p className="text-sm leading-relaxed text-slate-700">
          Your complete application details are stored in our system. You can view and download your full application below.
        </p>
      </div>

      {/* Action Button */}
      <button
        type="button"
        onClick={onViewApplication}
        className="w-full inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
      >
        View Complete Application
      </button>

      {/* Divider */}
      <div className="my-6 h-px bg-gradient-to-r from-emerald-200 via-emerald-300 to-emerald-200"></div>

      {/* Next Steps Section */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">What Happens Next?</h3>
        <ul className="space-y-2 text-sm text-slate-700">
          <li className="flex items-start gap-3">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0"></span>
            <span>You're now a registered member of our KK Profiling community</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0"></span>
            <span>You can now access member-only programs and benefits</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0"></span>
            <span>Keep this application safe for your records</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
