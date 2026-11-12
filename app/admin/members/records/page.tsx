import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkAndArchiveAgedOutMembers } from "@/lib/archiveAgedOutMembers";
import { normalizeAdminTablePageSize } from "@/lib/admin-pagination";
import AdminTablePaginationFooter from "../../AdminTablePaginationFooter";
import { ArchivedMembersTable } from "./ArchivedMembersTable";

export default async function MemberRecordsPage({ searchParams }: {
  searchParams: Promise<{
    page?: string | string[];
    pageSize?: string | string[];
    q?: string | string[];
  }>;
}) {
  const admin = await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);
  await checkAndArchiveAgedOutMembers(admin.id);

  const resolved = await searchParams;
  const getParam = (value?: string | string[]) => Array.isArray(value) ? value[0] : value;
  const requestedPage = Number(getParam(resolved.page) || 1);
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
  const requestedPageSize = Number(getParam(resolved.pageSize));
  const pageSize = normalizeAdminTablePageSize(requestedPageSize);
  const query = String(getParam(resolved.q) || "").trim();

  const where = {
    reviewStatus: "Archived",
    ...(query
      ? {
          OR: [
            { fullName: { contains: query, mode: "insensitive" as const } },
            { email: { contains: query, mode: "insensitive" as const } },
            { youthClassification: { contains: query, mode: "insensitive" as const } },
            { youthAgeGroup: { contains: query, mode: "insensitive" as const } },
            { archivedReason: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const skip = (page - 1) * pageSize;
  const [records, totalCount] = await Promise.all([
    prisma.profilingRegistration.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      take: pageSize,
      skip,
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
            grantee: { select: { id: true, status: true } },
          },
        },
      },
    }),
    prisma.profilingRegistration.count({ where }),
  ]);

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 sm:gap-8 pb-12">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">KK Youth Registry</span>
          <h1 className="mb-1.5 mt-0.5 text-2xl font-bold tracking-tight text-slate-900">Archived KK Youth</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-500">
            Review and export archived Katipunan ng Kabataan (KK) youth profiles retained for historical reference.
          </p>
        </div>
      </header>

      <section className="flex w-full flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <ArchivedMembersTable records={records} initialQuery={query} />

        <AdminTablePaginationFooter
          totalCount={totalCount}
          page={page}
          pageSize={pageSize}
          basePath="/admin/members/records"
        />
      </section>
    </div>
  );
}
