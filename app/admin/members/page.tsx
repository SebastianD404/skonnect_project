import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { listProfilingRegistrations, getProfilingRegistrationCountByStatus } from "@/lib/prisma";
import { KKProfilingRegistrationsTable } from "../kk-profiling/KKProfilingRegistrationsTable";
import { KKProfilingPagination } from "../kk-profiling/KKProfilingPagination";

const PAGE_SIZE = 7;

export default async function AdminMembersPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);

  const resolved = await searchParams;
  const rawPage = Array.isArray(resolved.page) ? resolved.page[0] : resolved.page;
  const pageNumber = Math.max(1, Number(rawPage || 1));
  const skip = (pageNumber - 1) * PAGE_SIZE;

  const [totalCount, approvedMembers] = await Promise.all([
    getProfilingRegistrationCountByStatus("Approved"),
    listProfilingRegistrations({
      where: { reviewStatus: "Approved" },
      orderBy: { submittedAt: "desc" },
      take: PAGE_SIZE,
      skip,
      include: {
        user: { select: { fullName: true, email: true } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="min-h-screen bg-[#F8FBFF] text-slate-950 py-12">
      <div className="mx-auto max-w-7xl space-y-8 px-6">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-10 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[#0F3D5C]">Members</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">SK youth members</h1>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                KK profiling applicants who have been approved are counted here as SK youth members in Barangay Pico.
                Review the list below to monitor registration coverage and membership status.
              </p>
            </div>
            <div className="rounded-3xl bg-slate-50 px-5 py-4 text-center shadow-sm">
              <p className="text-sm uppercase tracking-[0.28em] text-slate-500">SK youth members</p>
              <p className="mt-3 text-4xl font-black text-slate-950">{totalCount}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-950">SK youth members</h2>
              <p className="mt-2 text-sm text-slate-500">This page shows all youth profiles from the KK registration process that have completed approval.</p>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <KKProfilingRegistrationsTable registrations={approvedMembers} statusLabel="Approved" />
          </div>

          {totalPages > 1 && <KKProfilingPagination pageNumber={pageNumber} totalPages={totalPages} basePath="/admin/members" />}
        </div>
      </div>
    </div>
  );
}
