import { prisma } from "@/lib/prisma";
import { getAuditStartDate } from "@/lib/audit/time-range";
import { normalizeAdminTablePageSize } from "@/lib/admin-pagination";
import AuditLogsTable from "./AuditLogsTable";

export default async function SystemAdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; pageSize?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const rawPage = Array.isArray(resolvedSearchParams.page) ? resolvedSearchParams.page[0] : resolvedSearchParams.page;
  const rawPageSize = Array.isArray(resolvedSearchParams.pageSize)
    ? resolvedSearchParams.pageSize[0]
    : resolvedSearchParams.pageSize;
  const requestedPage = Number(rawPage || 1);
  const page = Number.isSafeInteger(requestedPage) ? Math.max(1, requestedPage) : 1;
  const requestedPageSize = Number(rawPageSize);
  const pageSize = normalizeAdminTablePageSize(requestedPageSize);
  const startDate = getAuditStartDate("30d");
  const where = startDate ? { createdAt: { gte: startDate } } : undefined;
  const totalCount = await prisma.auditLog.count({ where });
  const audits = await prisma.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      action: true,
      actorId: true,
      targetTable: true,
      targetId: true,
      beforeData: true,
      afterData: true,
      metadata: true,
      meta: true,
      createdAt: true,
      actor: {
        select: {
          fullName: true,
          email: true,
        },
      },
    },
  });

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 sm:gap-8">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <span>System Admin</span>
        <span>/</span>
        <span className="text-slate-900">Audit Logs</span>
      </div>

      <header className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">System Admin</p>
        <h1 className="text-4xl font-black text-slate-950 sm:text-5xl">Audit Logs</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Review recorded changes across the platform for compliance and accountability.
        </p>
      </header>

      <AuditLogsTable
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
        audits={audits.map((audit) => ({
          id: audit.id,
          action: audit.action,
          actorId: audit.actorId,
          targetTable: audit.targetTable,
          targetId: audit.targetId,
          beforeData: audit.beforeData,
          afterData: audit.afterData,
          metadata: audit.metadata,
          meta: audit.meta,
          createdAt: audit.createdAt.toISOString(),
          actorFullName: audit.actor.fullName,
          actorEmail: audit.actor.email,
        }))}
      />
    </div>
  );
}
