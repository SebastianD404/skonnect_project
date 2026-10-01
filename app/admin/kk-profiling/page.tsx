import { getProfilingRegistrationCount, getProfilingRegistrationCountByStatus, hasProfilingRegistrationColumn, listProfilingRegistrations } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import AdminTablePaginationFooter from "../AdminTablePaginationFooter";
import AdminExportButton from "../AdminExportButton";
import { KKProfilingRegistrationsTable } from "@/app/admin/kk-profiling/KKProfilingRegistrationsTable";
import { KKProfilingTableSearchField, KKProfilingTableSearchProvider } from "./KKProfilingTableSearch";
import KKProfilingStatusTabs from "./KKProfilingStatusTabs";

const PAGE_SIZES = [10, 20, 50] as const;

export default async function AdminKKProfilingPage({ searchParams }: { searchParams: Promise<{ page?: string | string[]; pageSize?: string | string[]; status?: string | string[] }> }) {
  await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);

  const resolvedSearchParams = await searchParams;
  const rawPage = Array.isArray(resolvedSearchParams.page) ? resolvedSearchParams.page[0] : resolvedSearchParams.page;
  const rawPageSize = Array.isArray(resolvedSearchParams.pageSize) ? resolvedSearchParams.pageSize[0] : resolvedSearchParams.pageSize;
  const rawStatus = Array.isArray(resolvedSearchParams.status) ? resolvedSearchParams.status[0] : resolvedSearchParams.status;
  const requestedPage = Number(rawPage || 1);
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
  const requestedPageSize = Number(rawPageSize);
  const pageSize = PAGE_SIZES.includes(requestedPageSize as (typeof PAGE_SIZES)[number])
    ? requestedPageSize
    : 10;
  const statusParam = String(rawStatus || "pending").toLowerCase();
  const skip = (page - 1) * pageSize;

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

  const selectedStatus = whereFilter?.reviewStatus;
  const [totalCount, registrations] = await Promise.all([
    hasReviewStatusColumn && selectedStatus
      ? getProfilingRegistrationCountByStatus(selectedStatus)
      : getProfilingRegistrationCount(),
    listProfilingRegistrations({
      where: whereFilter,
      orderBy: { submittedAt: "desc" },
      take: pageSize,
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
  const statusLabel = statusParam === "approved"
    ? "Approved"
    : statusParam === "returned"
    ? "Returned"
    : statusParam === "resubmitted"
    ? "Resubmitted"
    : "Pending";

  return (
    <KKProfilingTableSearchProvider>
      <div className="mx-auto flex w-full max-w-7xl flex-col pb-12 text-slate-950">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">KK Profiling</span>
            <h1 className="mb-1.5 mt-0.5 text-2xl font-bold tracking-tight text-slate-900">
              Registered youth profiling data
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-500">
              Review Katipunan ng Kabataan profiling registrations.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            <AdminExportButton
              href={`/api/admin/kk-profiling/export?status=${encodeURIComponent(statusParam)}`}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900"
              iconClassName="h-4 w-4 text-slate-400"
            />
          </div>
        </div>

        <div className="flex flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-4 sm:flex-row sm:items-center">
            <KKProfilingTableSearchField />
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

          <div className="w-full overflow-x-auto">
            <KKProfilingRegistrationsTable
              registrations={latestRegistrations}
              statusLabel={statusLabel}
              flat
              pageNumber={page}
              pageSize={pageSize}
            />
          </div>

          <AdminTablePaginationFooter
            totalCount={totalCount}
            page={page}
            pageSize={pageSize}
            basePath="/admin/kk-profiling"
          />
        </div>
      </div>
    </KKProfilingTableSearchProvider>
  );
}
