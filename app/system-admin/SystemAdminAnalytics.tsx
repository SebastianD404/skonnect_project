"use client";

import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  BookOpenText,
  Cable,
  Database,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type SystemActivityDay = {
  date: string;
  label: string;
  fullDate: string;
  count: number;
};

export type SystemActivityModule = {
  label: string;
  count: number;
  breakdown?: string;
};

export type SystemRoleCount = {
  label: string;
  count: number;
  color: string;
};

const QUICK_ACTIONS = [
  { label: "Manage Users", href: "/system-admin/users", icon: Users },
  { label: "Data Backup", href: "/system-admin/backups", icon: Database },
  { label: "API Integrations", href: "/system-admin/integrations", icon: Cable },
  { label: "AI Knowledge Base", href: "/system-admin/knowledge-base", icon: BookOpenText },
];

export default function SystemAdminAnalytics({
  activityByDay,
  activityByModule,
  roleCounts,
  totalUsers,
  totalEvents,
}: {
  activityByDay: SystemActivityDay[];
  activityByModule: SystemActivityModule[];
  roleCounts: SystemRoleCount[];
  totalUsers: number;
  totalEvents: number;
}) {
  const maxModuleCount = Math.max(1, ...activityByModule.map((module) => module.count));

  return (
    <section className="grid w-full grid-cols-1 gap-5 lg:grid-cols-12">
      <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5 lg:col-span-7">
        <header className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-700" aria-hidden="true" />
              <h2 className="text-sm font-bold text-slate-900">Platform Activity (Last 7 Days)</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">Daily audit and system events · PHT</p>
          </div>
          <span className="shrink-0 rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-semibold text-cyan-800">
            {totalEvents.toLocaleString("en-PH")} events
          </span>
        </header>

        <div
          role="img"
          aria-label="Platform activity during the last seven days"
          className="mt-3 h-[150px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={activityByDay} margin={{ top: 8, right: 6, bottom: 0, left: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#64748b", fontSize: 10 }}
              />
              <YAxis
                allowDecimals={false}
                width={40}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#94a3b8", fontSize: 10 }}
              />
              <Tooltip
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate ?? ""}
                formatter={(value) => [Number(value).toLocaleString("en-PH"), "Events"]}
                cursor={{ fill: "#f8fafc" }}
                contentStyle={{
                  borderRadius: "0.75rem",
                  borderColor: "#e2e8f0",
                  fontSize: "0.75rem",
                  boxShadow: "0 8px 24px rgba(15, 23, 42, .08)",
                }}
              />
              <Bar dataKey="count" name="Events" fill="#0891b2" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-2 border-t border-slate-100 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800">Activity by Module</h3>
            <span className="text-[10px] text-slate-400">Last 7 days</span>
          </div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-2.5">
            {activityByModule.map((module) => {
              const percentage = totalEvents > 0
                ? Math.round((module.count / totalEvents) * 100)
                : 0;
              return (
                <div
                  key={module.label}
                  title={module.label === "Other Modules" ? module.breakdown : undefined}
                >
                  <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate font-medium text-slate-600">{module.label}</span>
                    <span className="shrink-0 tabular-nums text-slate-500">
                      {module.count.toLocaleString("en-PH")} · {percentage}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-cyan-600 transition-[width]"
                      style={{ width: `${(module.count / maxModuleCount) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </article>

      <div className="flex flex-col gap-5 lg:col-span-5">
        <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-bold text-slate-900">Role Distribution</h2>
          <div className="mt-3 space-y-3">
            {roleCounts.map((role) => {
              const percentage = totalUsers > 0 ? (role.count / totalUsers) * 100 : 0;
              return (
                <div key={role.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{role.label}</span>
                    <span className="tabular-nums text-slate-500">{role.count.toLocaleString("en-PH")}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${role.color}`} style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-bold text-slate-900">Quick Actions</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map(({ label, href, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                className="group flex min-h-14 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50/70 hover:text-cyan-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0 text-cyan-700" aria-hidden="true" />
                  <span className="truncate">{label}</span>
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-400 transition group-hover:text-cyan-700" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
