import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import SubmissionReviewTable from "./SubmissionReviewTable";

export default async function AdminSubmissionsPage() {
  await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 sm:gap-8 min-h-screen bg-slate-50/60 pb-12">
      <div className="w-full">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Document Review Queue</span>
            <h1 className="mb-1.5 mt-0.5 text-2xl font-bold tracking-tight text-slate-900">Review scholarship documents</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-500">
              Approve compliant uploads or return specific files for correction with clear guidance.
            </p>
          </div>
        </header>

        <SubmissionReviewTable />
      </div>
    </div>
  );
}