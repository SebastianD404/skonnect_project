import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  FileText,
  Shield,
  ShieldCheck,
  ScrollText,
  TrendingUp,
  Users,
} from "lucide-react";

export default async function SystemAdminDashboardPage() {
  const [activeUsersCount, auditEntriesRows, adminAccountsCount, recentAudits, roleCounts] = await Promise.all([
    prisma.user.count({
      where: { isActive: true },
    }),
    prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM audit_logs WHERE "createdAt" >= NOW() - INTERVAL '30 days'`,
    prisma.user.count({
      where: {
        isActive: true,
        role: { in: ["SK_OFFICIAL", "SUPER_ADMIN"] },
      },
    }),
    prisma.auditLog.findMany({
      take: 4,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        action: true,
        targetTable: true,
        createdAt: true,
        actor: {
          select: {
            fullName: true,
          },
        },
      },
    }),
    prisma.user.groupBy({
      by: ["role"],
      _count: {
        role: true,
      },
    }),
  ]);

  const auditEntriesCount = Number(auditEntriesRows[0]?.count ?? 0);

  const totalUsers = Math.max(
    1,
    roleCounts.reduce((acc, item) => acc + item._count.role, 0)
  );
  const roleMap = new Map(roleCounts.map((item) => [item.role, item._count.role]));

  const roleDistribution = [
    { label: "Youth", count: roleMap.get("YOUTH") ?? 0, tone: "bg-[#2B8CD6]" },
    { label: "Grantee", count: roleMap.get("GRANTEE") ?? 0, tone: "bg-emerald-500" },
    {
      label: "SK Official",
      count: roleMap.get("SK_OFFICIAL") ?? 0,
      tone: "bg-amber-500",
    },
    {
      label: "Super Admin",
      count: roleMap.get("SUPER_ADMIN") ?? 0,
      tone: "bg-[#0F3D5C]",
    },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 sm:gap-8">
      <div className="mb-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            System Admin / Dashboard
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            System Administration
          </h1>
          <p className="text-sm text-slate-500">
            Platform governance, access controls, and immutable audit trails for Barangay Pico.
          </p>
        </div>
      </div>

      <section className="mb-6 grid w-full grid-cols-2 gap-3 sm:mb-8 sm:gap-4 lg:grid-cols-4 lg:gap-8">
        <Link
          href="/system-admin/users"
          className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md sm:rounded-3xl sm:p-5"
        >
          <div className="flex items-center justify-between">
            <span className="min-w-0 truncate text-[10px] font-bold tracking-wider text-slate-400 uppercase transition-colors group-hover:text-cyan-600 sm:text-[11px] sm:tracking-widest">
              Active Users
            </span>
            <div className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 sm:h-9 sm:w-9 sm:rounded-2xl">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black tracking-tight text-slate-900 sm:mt-4 sm:text-3xl">
            {activeUsersCount}
          </div>
          <div className="mt-2 flex items-center gap-1 truncate text-[11px] text-slate-500 sm:text-xs">
            <span className="truncate">Manage accounts</span> <ArrowRight className="h-3 w-3 shrink-0" />
          </div>
        </Link>

        <Link
          href="/system-admin/audit"
          className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md sm:rounded-3xl sm:p-5"
        >
          <div className="flex items-center justify-between">
            <span className="min-w-0 truncate text-[10px] font-bold tracking-wider text-slate-400 uppercase transition-colors group-hover:text-cyan-600 sm:text-[11px] sm:tracking-widest">
              Audit Entries
            </span>
            <div className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 sm:h-9 sm:w-9 sm:rounded-2xl">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black tracking-tight text-slate-900 sm:mt-4 sm:text-3xl">
            {auditEntriesCount}
          </div>
          <div className="mt-2 flex items-center gap-1 truncate text-[11px] text-slate-500 sm:text-xs">
            <span className="truncate">View compliance logs</span> <ArrowRight className="h-3 w-3 shrink-0" />
          </div>
        </Link>

        <Link
          href="/system-admin/users"
          className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md sm:rounded-3xl sm:p-5"
        >
          <div className="flex items-center justify-between">
            <span className="min-w-0 truncate text-[10px] font-bold tracking-wider text-slate-400 uppercase transition-colors group-hover:text-indigo-600 sm:text-[11px] sm:tracking-widest">
              Privileged Accounts
            </span>
            <div className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 sm:h-9 sm:w-9 sm:rounded-2xl">
              <Shield className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black tracking-tight text-slate-900 sm:mt-4 sm:text-3xl">
            {adminAccountsCount}
          </div>
          <div className="mt-2 flex items-center gap-1 truncate text-[11px] text-slate-500 sm:text-xs">
            <span className="truncate">Active SK Officials &amp; Super Admins</span> <ArrowRight className="h-3 w-3 shrink-0" />
          </div>
        </Link>

        <Link
          href="/system-admin/reconcile"
          className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md sm:rounded-3xl sm:p-5"
        >
          <div className="flex items-center justify-between">
            <span className="min-w-0 truncate text-[10px] font-bold tracking-wider text-slate-400 uppercase transition-colors group-hover:text-emerald-600 sm:text-[11px] sm:tracking-widest">
              System Security
            </span>
            <div className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 sm:h-9 sm:w-9 sm:rounded-2xl">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black tracking-tight text-slate-900 sm:mt-4 sm:text-3xl">Enforced</div>
          <div className="mt-2 flex items-center gap-1 truncate text-[11px] text-slate-500 sm:text-xs">
            <span className="truncate">System Admin routes are role-gated</span> <ArrowRight className="h-3 w-3 shrink-0" />
          </div>
        </Link>

      </section>

      <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 w-full">
        <div className="overflow-hidden rounded-2xl border border-[#D6E1EC] bg-white shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-[#E4ECF3] px-6 py-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#0F3D5C]" />
              <h2 className="text-xl font-black text-slate-900">Recent activity</h2>
            </div>
            <Link href="/system-admin/audit" className="text-xs font-semibold text-[#0F3D5C] hover:underline">
              View all
            </Link>
          </div>

          {recentAudits.length > 0 ? (
            <ul className="divide-y divide-[#E8EEF5]">
              {recentAudits.map((audit) => (
                <li key={audit.id} className="flex items-start gap-4 px-6 py-4">
                  <div className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-700">
                    <ScrollText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <p className="font-semibold text-slate-900">
                        {audit.action.replaceAll("_", " ").toLowerCase()}
                      </p>
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                        {audit.targetTable}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      by {audit.actor.fullName} ·{" "}
                      {new Date(audit.createdAt).toISOString().replace("T", " ").slice(0, 16)} UTC
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-slate-400" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-6 py-8 text-sm text-slate-500">No recent audit activity yet.</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:col-span-2 xl:grid-cols-2">
          <div className="rounded-2xl border border-[#D6E1EC] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#0F3D5C]" />
              <h3 className="text-lg font-black text-slate-900">Quick actions</h3>
            </div>
            <div className="mt-4 space-y-2">
              {[
                { label: "Manage User Roles", href: "/system-admin/users" },
                { label: "View & Export Audit Logs", href: "/system-admin/audit" },
                { label: "Reconcile Auth Users", href: "/system-admin/reconcile" },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center justify-between rounded-xl border border-[#D6E1EC] bg-[#F9FBFD] px-4 py-3 text-sm font-medium text-slate-800 transition hover:border-[#C0D4E5] hover:bg-[#F2F7FC]"
                >
                  {item.label}
                  <ArrowUpRight className="h-4 w-4 text-slate-400" />
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#D6E1EC] bg-gradient-to-b from-white to-[#F3F8FC] p-6 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Role distribution
            </p>
            <div className="mt-4 space-y-3">
              {roleDistribution.map((role) => {
                const pct = (Number(role.count) / Number(totalUsers)) * 100;
                return (
                  <div key={role.label}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-900">{role.label}</span>
                      <span className="tabular-nums text-slate-500">{String(role.count)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div className={`h-full rounded-full ${role.tone}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
