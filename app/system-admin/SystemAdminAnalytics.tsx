"use client";

import Link from "next/link";
import {
  Activity,
  BookOpen,
  DatabaseBackup,
  Lock,
  MailCheck,
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

type SystemReadiness = {
  latestBackupLabel: string;
  isBackupFresh: boolean;
  knowledgeCount: number;
  isKnowledgeActive: boolean;
  isEmailConfigured: boolean;
  isStorageConfigured: boolean;
  isStorageReachable: boolean;
  totalAudit7d: number;
  securityAlerts7d: number;
};

function ReadinessStatus({
  healthyLabel,
  actionLabel,
  ready,
  href,
}: {
  healthyLabel: string;
  actionLabel: string;
  ready: boolean;
  href: string;
}) {
  return ready ? (
    <span className="inline-flex shrink-0 items-center justify-end gap-2 text-xs font-medium text-slate-600">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
      {healthyLabel}
    </span>
  ) : (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
    >
      {actionLabel}
    </Link>
  );
}

export default function SystemAdminAnalytics({
  activityByDay,
  activityByModule,
  roleCounts,
  totalUsers,
  totalEvents,
  readiness,
}: {
  activityByDay: SystemActivityDay[];
  activityByModule: SystemActivityModule[];
  roleCounts: SystemRoleCount[];
  totalUsers: number;
  totalEvents: number;
  readiness: SystemReadiness;
}) {
  const maxModuleCount = Math.max(1, ...activityByModule.map((module) => module.count));
  const peakDay = activityByDay.reduce<SystemActivityDay | null>(
    (peak, day) => (peak === null || day.count > peak.count ? day : peak),
    null,
  );
  const topModule = activityByModule.reduce<SystemActivityModule | null>(
    (top, module) => (top === null || module.count > top.count ? module : top),
    null,
  );
  const topModulePercentage =
    topModule && totalEvents > 0
      ? Math.round((topModule.count / totalEvents) * 100)
      : null;
  const systemOperational =
    readiness.isBackupFresh &&
    readiness.isKnowledgeActive &&
    readiness.isEmailConfigured &&
    readiness.isStorageReachable &&
    readiness.securityAlerts7d === 0;
  const servicesConfigured = readiness.isEmailConfigured && readiness.isStorageReachable;
  const servicesDiagnostic = servicesConfigured
    ? "Email delivery & file storage active"
    : !readiness.isEmailConfigured && !readiness.isStorageConfigured
      ? "Email & storage config missing"
      : !readiness.isEmailConfigured
        ? "Email configuration missing"
        : !readiness.isStorageConfigured
          ? "Supabase Storage keys missing"
          : "Supabase Storage unreachable";

  return (
    <section className="grid w-full grid-cols-1 gap-5 lg:grid-cols-12">
      <article className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 pb-3 shadow-sm sm:p-5 sm:pb-3.5 lg:col-span-7">
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
          className="mt-3 h-48 w-full"
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

        <div className="mt-2.5 grid grid-cols-3 gap-3 border-t border-slate-100 pt-3.5">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-400">Daily Average</p>
            <p className="mt-0.5 truncate text-xs font-semibold text-slate-800">
              {Math.round(totalEvents / 7).toLocaleString("en-PH")} / day
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-400">Peak Activity</p>
            <p className="mt-0.5 truncate text-xs font-semibold text-slate-800">
              {peakDay && peakDay.count > 0
                ? `${peakDay.label} · ${peakDay.count.toLocaleString("en-PH")}`
                : "—"}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-400">Top Module</p>
            <p className="mt-0.5 truncate text-xs font-semibold text-slate-800">
              {topModule && topModulePercentage !== null
                ? `${topModule.label} (${topModulePercentage}%)`
                : "—"}
            </p>
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

        <article className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
          <header className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-slate-900">System Readiness</h2>
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                systemOperational
                  ? "border-emerald-200 bg-emerald-50/80 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  systemOperational ? "bg-emerald-500" : "bg-amber-500"
                }`}
                aria-hidden="true"
              />
              {systemOperational ? "All Systems Operational" : "Attention Needed"}
            </span>
          </header>

          <div className="mt-2 divide-y divide-slate-100">
            <div className="flex items-center gap-3 py-3">
              <DatabaseBackup className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-800">Automated Backups</p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {readiness.latestBackupLabel}
                </p>
              </div>
              <ReadinessStatus
                healthyLabel="Verified"
                actionLabel="Backup Needed"
                ready={readiness.isBackupFresh}
                href="/system-admin/backups"
              />
            </div>

            <div className="flex items-center gap-3 py-3">
              <BookOpen className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-800">AI Knowledge Base</p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {readiness.knowledgeCount.toLocaleString("en-PH")} indexed documents
                </p>
              </div>
              <ReadinessStatus
                healthyLabel="Active"
                actionLabel="Add Documents"
                ready={readiness.isKnowledgeActive}
                href="/system-admin/knowledge-base"
              />
            </div>

            <div className="flex items-center gap-3 py-3">
              <MailCheck className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-800">Email &amp; Storage Services</p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {servicesDiagnostic}
                </p>
              </div>
              <ReadinessStatus
                healthyLabel="Connected"
                actionLabel="Needs Setup"
                ready={servicesConfigured}
                href="/system-admin/integrations"
              />
            </div>

            <div className="flex items-center gap-3 py-3">
              <Lock className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-800">Audit &amp; Access Governance</p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {readiness.totalAudit7d.toLocaleString("en-PH")} audit events ·{" "}
                  {readiness.securityAlerts7d.toLocaleString("en-PH")} alerts (7d)
                </p>
              </div>
              <ReadinessStatus
                healthyLabel="Enforced"
                actionLabel="Review Alerts"
                ready={readiness.securityAlerts7d === 0}
                href="/system-admin/audit"
              />
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
