import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  ScrollText,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";

export default async function SystemAdminDashboardPage() {
  const [activeUserCount, roleUpdateCount, auditCount, recentAudits, roleCounts] =
    await Promise.all([
      prisma.user.count({
        where: { isActive: true },
      }),
      prisma.auditLog.count({
        where: {
          action: {
            contains: "ROLE",
            mode: "insensitive",
          },
        },
      }),
      prisma.auditLog.count(),
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

  const stats = [
    {
      label: "Active Users",
      value: activeUserCount,
      delta: "Currently active accounts",
      icon: Users,
      tone: "bg-[#0F3D5C]/10 text-[#0F3D5C]",
    },
    {
      label: "Role Updates",
      value: roleUpdateCount,
      delta: "Role-related log entries",
      icon: ShieldCheck,
      tone: "bg-sky-100 text-sky-700",
    },
    {
      label: "Audit Entries",
      value: auditCount,
      delta: "All recorded governance logs",
      icon: ScrollText,
      tone: "bg-emerald-100 text-emerald-700",
    },
    {
      label: "Pending Reviews",
      value: 0,
      delta: "No pending review workflows",
      icon: AlertTriangle,
      tone: "bg-amber-100 text-amber-700",
    },
  ] as const;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <span className="text-slate-900">System Admin</span>
        <span>/</span>
        <span>Dashboard</span>
      </div>

      <section className="relative overflow-hidden rounded-3xl border border-[#14476B]/20 bg-gradient-to-br from-[#0F3D5C] via-[#1B5F86] to-[#24A4D8] p-8 text-white shadow-xl lg:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.22),transparent_45%),radial-gradient(circle_at_100%_100%,rgba(255,255,255,0.18),transparent_40%)]" />
        <div className="relative grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:items-center">
          <div className="space-y-5">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-200" />
              System Admin Console
            </span>
            <h1 className="text-4xl font-black leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl">
              Oversee users,
              <br />
              permissions, and
              <br />
              audit history.
            </h1>
            <p className="max-w-xl text-base text-slate-100/85 sm:text-lg">
              Manage roles, review system logs, and keep the SKonnect platform secure and
              compliant for Barangay Pico.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/system-admin/users"
                className="group inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#0F3D5C] transition hover:bg-white/90"
              >
                Manage users
                <ArrowUpRight className="h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/system-admin/audit"
                className="inline-flex items-center gap-2 rounded-xl border border-white/35 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                Audit history
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-100/80">
              Governance pulse
            </p>
            <p className="mt-2 text-3xl font-black">Today at a glance</p>
            <div className="mt-5 space-y-4">
              {[
                { label: "Sign-ins (24h)", value: "--", trend: "live" },
                { label: "Role changes", value: String(roleUpdateCount), trend: "records" },
                { label: "Security alerts", value: "0", trend: "stable" },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between border-b border-white/15 pb-3 last:border-0 last:pb-0"
                >
                  <span className="text-sm text-slate-100/80">{row.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold tabular-nums">{row.value}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-200">
                      {row.trend}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, delta, icon: Icon, tone }) => (
          <div
            key={label}
            className="rounded-2xl border border-[#D6E1EC] bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {label}
                </p>
                <p className="mt-3 text-4xl font-black tabular-nums text-slate-900">{value}</p>
              </div>
              <div className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">{delta}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 overflow-hidden rounded-2xl border border-[#D6E1EC] bg-white shadow-sm">
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

        <div className="space-y-4">
          <div className="rounded-2xl border border-[#D6E1EC] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#0F3D5C]" />
              <h3 className="text-lg font-black text-slate-900">Quick actions</h3>
            </div>
            <div className="mt-4 space-y-2">
              {[
                { label: "Assign a new role", href: "/system-admin/users" },
                { label: "Review audit logs", href: "/system-admin/audit" },
                { label: "Export user report", href: "/system-admin/users" },
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
                const pct = (role.count / totalUsers) * 100;
                return (
                  <div key={role.label}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-900">{role.label}</span>
                      <span className="tabular-nums text-slate-500">{role.count}</span>
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
