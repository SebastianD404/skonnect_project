import { getProfilingRegistrationCount, getProfilingRegistrationCountByStatus, hasProfilingRegistrationColumn, listProfilingRegistrations } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import { KKProfilingPagination } from "./KKProfilingPagination";
import { KKProfilingRegistrationsTable } from "@/app/admin/kk-profiling/KKProfilingRegistrationsTable";
import KKProfilingStatusTabs from "./KKProfilingStatusTabs";

const PAGE_SIZE = 7;

export default async function AdminKKProfilingPage({ searchParams }: { searchParams: Promise<{ page?: string | string[]; status?: string | string[] }> }) {
  await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);

  const resolvedSearchParams = await searchParams;
  const rawPage = Array.isArray(resolvedSearchParams.page) ? resolvedSearchParams.page[0] : resolvedSearchParams.page;
  const rawStatus = Array.isArray(resolvedSearchParams.status) ? resolvedSearchParams.status[0] : resolvedSearchParams.status;
  const pageNumber = Math.max(1, Number(rawPage || 1));
  const statusParam = String(rawStatus || "").toLowerCase();
  const skip = (pageNumber - 1) * PAGE_SIZE;

  const hasReviewStatusColumn = await hasProfilingRegistrationColumn("reviewStatus");
  const whereFilter =
    hasReviewStatusColumn && statusParam === "approved"
      ? { reviewStatus: "Approved" }
      : hasReviewStatusColumn && statusParam === "pending"
      ? { reviewStatus: "Pending" }
      : hasReviewStatusColumn && statusParam === "returned"
      ? { reviewStatus: "Returned" }
      : hasReviewStatusColumn && statusParam === "resubmitted"
      ? { reviewStatus: "Resubmitted" }
      : undefined;

  const [totalCount, registrations] = await Promise.all([
    hasReviewStatusColumn
      ? getProfilingRegistrationCountByStatus("Approved")
      : getProfilingRegistrationCount(),
    listProfilingRegistrations({
      where: whereFilter,
      orderBy: { submittedAt: "desc" },
      take: PAGE_SIZE,
      skip,
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
    }),
  ]);

  const latestRegistrations = registrations;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="min-h-screen bg-[#F8FBFF] text-slate-950">
      <div className="px-8 py-10">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-10 shadow-sm">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[#0F3D5C]">KK Profiling</p>
                <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">
                  Registered youth profiling data
                </h1>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  Review Katipunan ng Kabataan profiling registrations submitted by SK officials and youth participants. Use this page to monitor demographic coverage, confirm SK voter status, and identify youth who still need follow-up.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.35em] text-[#0F3D5C]">Latest entries</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Recent KK profiling submissions</h2>
              </div>
              <div className="flex items-center gap-3">
                {/* Export CSV removed — not needed by clients */}
                <div className="relative">
                  <KKProfilingStatusTabs
                    currentStatus={
                      statusParam === "approved"
                        ? "approved"
                        : statusParam === "returned"
                        ? "returned"
                        : statusParam === "resubmitted"
                        ? "resubmitted"
                        : "pending"
                    }
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <KKProfilingRegistrationsTable
                registrations={latestRegistrations}
                statusLabel={
                  statusParam === "approved"
                    ? "Approved"
                    : statusParam === "returned"
                    ? "Returned"
                    : statusParam === "resubmitted"
                    ? "Resubmitted"
                    : "Pending"
                }
              />
            </div>

            {totalPages > 1 && <KKProfilingPagination pageNumber={pageNumber} totalPages={totalPages} />}
          </div>
        </div>
      </div>
    </div>
  );
}
