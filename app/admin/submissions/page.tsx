import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import SubmissionReviewTable from "./SubmissionReviewTable";

export default async function AdminSubmissionsPage() {
  await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-12">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Document Review Queue</span>
          <h1 className="mb-1.5 mt-0.5 text-2xl font-bold tracking-tight text-slate-900">Review scholarship documents</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-500">
            Approve compliant uploads or return specific files for correction with clear guidance.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <a
            href="/api/admin/submissions/export"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50"
          >
            Export Submissions
          </a>
        </div>
      </header>

      <SubmissionReviewTable />
    </div>
  );
}