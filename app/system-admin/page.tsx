import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  ArrowRight,
  FileText,
  Shield,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import SystemAdminAnalytics, {
  type SystemActivityDay,
  type SystemActivityModule,
  type SystemRoleCount,
} from "./SystemAdminAnalytics";
import {
  aggregateAuditActivityModules,
  normalizeAuditActivityModule,
} from "@/lib/system-admin-activity";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const PHT_OFFSET_MS = 8 * 60 * 60 * 1000;

type ActivityRow = {
  day: string;
  targetTable: string | null;
  action: string;
  eventCount: bigint;
};

function getPhtActivityWindow(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const todayUtc = Date.UTC(value("year"), value("month") - 1, value("day"));

  return {
    startAt: new Date(todayUtc - 6 * DAY_MS - PHT_OFFSET_MS),
    endAt: now,
    dates: Array.from({ length: 7 }, (_, index) => {
      const date = new Date(todayUtc + (index - 6) * DAY_MS);
      const key = date.toISOString().slice(0, 10);
      const localDate = new Date(`${key}T12:00:00+08:00`);
      return {
        date: key,
        label: new Intl.DateTimeFormat("en-PH", {
          weekday: "short",
          timeZone: "Asia/Manila",
        }).format(localDate),
        fullDate: new Intl.DateTimeFormat("en-PH", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "Asia/Manila",
        }).format(localDate),
      };
    }),
  };
}

function formatActionLabel(action: string) {
  if (action === "FLAG_SUBMISSION_FOR_CORRECTION") {
    return "Submission Flagged for Correction";
  }
  return action
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => {
      if (word === "kk") return "KK";
      if (word === "api") return "API";
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function formatModuleLabel(targetTable: string, action: string) {
  return normalizeAuditActivityModule(targetTable, action);
}

function formatPhtTimestamp(date: Date) {
  const formatted = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(date);
  return `${formatted.replace(" at ", ", ")} PHT`;
}

function MetricCard({
  href,
  label,
  value,
  subtitle,
  icon: Icon,
  iconTone,
}: {
  href?: string;
  label: string;
  value: string | number;
  subtitle: string;
  icon: LucideIcon;
  iconTone: string;
}) {
  const content = (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 58% 70% at 95% 5%, rgba(56, 189, 248, 0.16) 0%, rgba(103, 232, 249, 0.06) 42%, transparent 100%)",
        }}
      />
      <div className="relative z-10 flex min-w-0 items-center justify-between gap-3">
        <span className="eyebrow min-w-0 truncate text-[10px] font-bold uppercase tracking-widest text-slate-400 transition-colors group-hover:text-cyan-700">
          {label}
        </span>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconTone}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <div className="relative z-10 min-w-0">
        <p className="text-2xl font-extrabold leading-none tracking-tight text-slate-950">
          {typeof value === "number" ? value.toLocaleString("en-PH") : value}
        </p>
        <p className="mt-1 truncate text-[11px] font-medium text-slate-500">{subtitle}</p>
      </div>
      {href ? (
        <ArrowRight className="absolute bottom-4 right-4 h-3.5 w-3.5 text-cyan-700/60 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      ) : null}
    </>
  );
  const className =
    "group relative flex min-h-[112px] flex-col justify-between gap-3 overflow-hidden rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_6px_24px_-6px_rgba(14,116,144,0.09)] transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-[0_8px_28px_-6px_rgba(14,116,144,0.14)]";

  return href ? (
    <Link href={href} aria-label={`${label}: ${value}. ${subtitle}`} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

export default async function SystemAdminDashboardPage() {
  const now = new Date();
  const activityWindow = getPhtActivityWindow(now);
  const [
    activeUsersCount,
    auditEntriesRows,
    adminAccountsCount,
    recentAudits,
    roleCounts,
    activityRows,
  ] = await Promise.all([
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
      take: 5,
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
    prisma.$queryRaw<ActivityRow[]>`
      SELECT
        to_char("createdAt" + INTERVAL '8 hours', 'YYYY-MM-DD') AS day,
        "targetTable" AS "targetTable",
        action AS action,
        COUNT(*)::bigint AS "eventCount"
      FROM audit_logs
      WHERE "createdAt" >= ${activityWindow.startAt}
        AND "createdAt" <= ${activityWindow.endAt}
      GROUP BY 1, 2, 3
      ORDER BY 1 ASC
    `,
  ]);

  const auditEntriesCount = Number(auditEntriesRows[0]?.count ?? 0);
  const roleMap = new Map(roleCounts.map((item) => [item.role, item._count.role]));
  const totalUsers = roleCounts.reduce((total, item) => total + item._count.role, 0);
  const activityTotalsByDate = new Map<string, number>();

  for (const row of activityRows) {
    const count = Number(row.eventCount);
    activityTotalsByDate.set(row.day, (activityTotalsByDate.get(row.day) ?? 0) + count);
  }

  const totalEvents = activityRows.reduce((total, row) => total + Number(row.eventCount), 0);
  const activityByDay: SystemActivityDay[] = activityWindow.dates.map((date) => ({
    ...date,
    count: activityTotalsByDate.get(date.date) ?? 0,
  }));
  const activityByModule: SystemActivityModule[] = aggregateAuditActivityModules(activityRows);
  const roleDistribution: SystemRoleCount[] = [
    { label: "Youth", count: roleMap.get("YOUTH") ?? 0, color: "bg-sky-500" },
    { label: "SK Officials", count: roleMap.get("SK_OFFICIAL") ?? 0, color: "bg-cyan-600" },
    { label: "Super Admins", count: roleMap.get("SUPER_ADMIN") ?? 0, color: "bg-slate-800" },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          System Admin / Dashboard
        </p>
        <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-900">
          System Administration
        </h1>
        <p className="text-sm text-slate-500">
          Platform governance, access controls, and immutable audit trails for Barangay Pico.
        </p>
      </header>

      <section
        aria-label="System overview"
        className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          href="/system-admin/users"
          label="Active Users"
          value={activeUsersCount}
          subtitle="Manage accounts"
          icon={Users}
          iconTone="bg-sky-50 text-sky-700 ring-1 ring-sky-100"
        />
        <MetricCard
          href="/system-admin/audit"
          label="Audit Entries"
          value={auditEntriesCount}
          subtitle="Last 30 days · View compliance logs"
          icon={FileText}
          iconTone="bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100"
        />
        <MetricCard
          href="/system-admin/users"
          label="Privileged Accounts"
          value={adminAccountsCount}
          subtitle="Active SK Officials & Super Admins"
          icon={Shield}
          iconTone="bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100"
        />
        <MetricCard
          label="System Security"
          value="Enforced"
          subtitle="System Admin routes are role-gated"
          icon={ShieldCheck}
          iconTone="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
        />
      </section>

      <SystemAdminAnalytics
        activityByDay={activityByDay}
        activityByModule={activityByModule}
        roleCounts={roleDistribution}
        totalUsers={totalUsers}
        totalEvents={totalEvents}
      />

      <section
        aria-labelledby="recent-activity-title"
        className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 id="recent-activity-title" className="text-sm font-bold text-slate-900">
            Recent activity
          </h2>
          <Link
            href="/system-admin/audit"
            className="text-xs font-semibold text-cyan-800 hover:text-cyan-950 hover:underline"
          >
            View all
          </Link>
        </header>

        {recentAudits.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {recentAudits.map((audit) => (
              <li key={audit.id} className="flex items-start gap-3 px-4 py-2.5 sm:px-5">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-cyan-50 text-cyan-800">
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-xs font-semibold text-slate-900">{formatActionLabel(audit.action)}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      {formatModuleLabel(audit.targetTable, audit.action)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {audit.actor.fullName || "System"} · {formatPhtTimestamp(audit.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-xs text-slate-500">No recent audit activity yet.</p>
        )}
      </section>
    </div>
  );
}
