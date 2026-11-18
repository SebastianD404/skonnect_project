import {
  getKkProfilingAdminViewCounts,
  getKkProfilingAdminViewCount,
  listKkProfilingAdminViewRows,
  type KkProfilingAdminViewRow,
} from "@/lib/admin-application-views";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import AdminTablePaginationFooter from "../AdminTablePaginationFooter";
import { KKProfilingRegistrationsTable } from "@/app/admin/kk-profiling/KKProfilingRegistrationsTable";
import { KKProfilingTableSearchField, KKProfilingTableSearchProvider } from "./KKProfilingTableSearch";
import KKProfilingStatusTabs from "./KKProfilingStatusTabs";
import { normalizeAdminTablePageSize } from "@/lib/admin-pagination";
import type { KKProfilingRegistration } from "./types";
import { prisma } from "@/lib/prisma";

function toKKProfilingRegistration(
  row: KkProfilingAdminViewRow,
  duplicateInfo?: {
    duplicateFlag: string | null;
    duplicateNote: string | null;
  },
): KKProfilingRegistration {
  return {
    ...row,
    reviewStatus: row.status,
    duplicateFlag: duplicateInfo?.duplicateFlag ?? null,
    duplicateNote: duplicateInfo?.duplicateNote ?? null,
    user: {
      fullName: row.fullName,
      email: row.email,
      grantee: row.granteeId && row.skeapStatus
        ? { id: row.granteeId, status: row.skeapStatus }
        : null,
    },
  };
}

export default async function AdminKKProfilingPage({ searchParams }: { searchParams: Promise<{ page?: string | string[]; pageSize?: string | string[]; status?: string | string[]; focus?: string | string[] }> }) {
  await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);

  const resolvedSearchParams = await searchParams;
  const rawPage = Array.isArray(resolvedSearchParams.page) ? resolvedSearchParams.page[0] : resolvedSearchParams.page;
  const rawPageSize = Array.isArray(resolvedSearchParams.pageSize) ? resolvedSearchParams.pageSize[0] : resolvedSearchParams.pageSize;
  const rawStatus = Array.isArray(resolvedSearchParams.status) ? resolvedSearchParams.status[0] : resolvedSearchParams.status;
  const rawFocus = Array.isArray(resolvedSearchParams.focus) ? resolvedSearchParams.focus[0] : resolvedSearchParams.focus;
  const focusId = typeof rawFocus === "string" ? rawFocus : "";
  const requestedPage = Number(rawPage || 1);
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
  const requestedPageSize = Number(rawPageSize);
  const pageSize = normalizeAdminTablePageSize(requestedPageSize);
  const requestedStatus = String(rawStatus || "pending").toLowerCase();
  const statusParam = requestedStatus === "rejected"
    ? "withdrawn"
    : ["pending", "returned", "resubmitted", "withdrawn", "physical-ctc"].includes(requestedStatus)
      ? requestedStatus
      : "pending";
  const skip = (page - 1) * pageSize;
  const statusLabel =
    statusParam === "returned"
      ? "Returned"
      : statusParam === "resubmitted"
        ? "Resubmitted"
        : statusParam === "physical-ctc"
          ? "For Physical CTC"
        : statusParam === "withdrawn"
          ? "Withdrawn"
          : "Pending";

  const [totalCount, rows, focusedRows, statusCounts] = await Promise.all([
    getKkProfilingAdminViewCount(statusParam),
    listKkProfilingAdminViewRows({ status: statusParam, take: pageSize, skip }),
    focusId
      ? listKkProfilingAdminViewRows({ status: statusParam, id: focusId, take: 1, skip: 0 })
      : Promise.resolve([]),
    getKkProfilingAdminViewCounts(),
  ]);
  const userIds = [...new Set(
    [...rows, ...focusedRows]
      .map((row) => row.userId)
      .filter((userId): userId is string => Boolean(userId)),
  )];
  const usersWithKkProfiles = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          kkProfile: { select: { duplicateFlag: true, duplicateNote: true } },
        },
      })
    : [];
  const duplicateInfoByUserId = new Map(
    usersWithKkProfiles.map((user) => [user.id, user.kkProfile]),
  );
  const withDuplicateInfo = (row: KkProfilingAdminViewRow) =>
    toKKProfilingRegistration(
      row,
      row.userId ? duplicateInfoByUserId.get(row.userId) ?? undefined : undefined,
    );
  const registrations = rows.map(withDuplicateInfo);
  const focusedRegistrations = focusedRows.map(withDuplicateInfo);

  const latestRegistrations = focusedRegistrations.length > 0
    ? [
        ...focusedRegistrations,
        ...registrations.filter((registration) => registration.id !== focusId),
      ].slice(0, pageSize)
    : registrations;
  return (
    <KKProfilingTableSearchProvider>
      <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 sm:gap-8 pb-12 text-slate-950">
        <div className="mb-6">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              PROGRAMS &amp; ENGAGEMENT / KK PROFILING APPLICATIONS
            </span>
            <h1 className="mb-1.5 mt-0.5 text-2xl font-bold tracking-tight text-slate-900">
              KK Profiling Applications
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-500">
              Review Katipunan ng Kabataan profiling registrations.
            </p>
          </div>
        </div>

        <KKProfilingStatusTabs currentStatus={statusParam} counts={statusCounts} />

        <div className="flex flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-4 sm:flex-row sm:items-center">
            <KKProfilingTableSearchField />
            <p className="shrink-0 text-xs font-medium text-slate-500">
              Showing {totalCount} registrations
            </p>
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
