import { prisma } from "@/lib/prisma";
import AuditLogsTable from "./AuditLogsTable";

export default async function SystemAdminAuditPage() {
  const audits = await prisma.auditLog.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      action: true,
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
    <div className="mx-auto max-w-7xl space-y-8">
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
        audits={audits.map((audit) => ({
          id: audit.id,
          action: audit.action,
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
