import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import SubmissionReviewTable from "./SubmissionReviewTable";

export default async function AdminSubmissionsPage() {
  await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);

  return (
    <div className="min-h-screen bg-[#F8FBFF] text-slate-950">
      <div className="px-8 py-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col justify-between gap-6 pt-2 md:flex-row md:items-end">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-700">
                Document Review Queue
              </span>
              <h1 className="mb-2 mt-1 text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
                Review scholarship documents
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-slate-500">
                Approve compliant uploads or return specific files for correction with clear guidance.
              </p>
            </div>
          </div>

          <SubmissionReviewTable />
        </div>
      </div>
    </div>
  );
}