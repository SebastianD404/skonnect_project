import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { listProfilingRegistrations } from "@/lib/prisma";
import { KKProfilingRegistrationsTable } from "../kk-profiling/KKProfilingRegistrationsTable";

export default async function AdminMembersPage() {
  await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);

  const approvedMembers = await listProfilingRegistrations({
    where: { reviewStatus: "Approved" },
    orderBy: { submittedAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-[#F8FBFF] text-slate-950 py-12">
      <div className="mx-auto max-w-7xl space-y-8 px-6">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-10 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[#0F3D5C]">Members</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">
                SK youth members
              </h1>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                KK profiling applicants who have been approved are counted here as SK youth members in Barangay Pico.
                Review the list below to monitor registration coverage and membership status.
              </p>
            </div>
            <div className="rounded-3xl bg-slate-50 px-5 py-4 text-center shadow-sm">
              <p className="text-sm uppercase tracking-[0.28em] text-slate-500">SK youth members</p>
              <p className="mt-3 text-4xl font-black text-slate-950">{approvedMembers.length}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-950">SK youth members</h2>
              <p className="mt-2 text-sm text-slate-500">
                This page shows all youth profiles from the KK registration process that have completed approval.
              </p>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <KKProfilingRegistrationsTable registrations={approvedMembers} statusLabel="SK members" />
          </div>
        </div>
      </div>
    </div>
  );
}
