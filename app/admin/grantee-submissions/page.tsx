import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import SubmissionReviewTable from "../submissions/SubmissionReviewTable";
import SubmissionWindowStatus from "./SubmissionWindowStatus";

export default async function GranteeSubmissionsPage() {
  await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 bg-slate-50/60 pb-12 sm:gap-8">
      <section>
        <header className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Document Review Queue</span>
            <h1 className="mb-1.5 mt-0.5 text-2xl font-bold tracking-tight text-slate-900">Review scholarship documents</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-500">
              Approve compliant uploads or return specific files for correction with clear guidance.
            </p>
            <SubmissionWindowStatus />
          </div>
        </header>
        <SubmissionReviewTable />
      </section>
    </div>
  );
}
