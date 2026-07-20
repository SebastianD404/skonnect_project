import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role, type Prisma } from "@prisma/client";
import InquiriesPageClient from "../InquiriesPageClient";
import type { TimePeriod } from "../DashboardHeaderWrapper";

type StatItem = {
  label: string;
  value: string;
  sub: string;
  delta: string;
  up: boolean;
  iconName: "Users" | "CalendarDays" | "Inbox" | "Check";
};

function formatDelta(current: number, previous: number) {
  if (previous === 0) {
    return {
      delta: current === 0 ? "0%" : `+${current}`,
      up: current >= 0,
    };
  }

  const value = Math.round(((current - previous) / previous) * 100);
  return {
    delta: `${value >= 0 ? "+" : ""}${value}%`,
    up: value >= 0,
  };
}

export default async function AdminInquiriesPage() {
  await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - 7);

  const startOfMonth = new Date(startOfToday);
  startOfMonth.setDate(startOfToday.getDate() - 30);

  const startOfQuarter = new Date(startOfToday);
  startOfQuarter.setDate(startOfToday.getDate() - 90);

  const prevDay = new Date(startOfToday);
  prevDay.setDate(startOfToday.getDate() - 1);

  const prevWeek = new Date(startOfWeek);
  prevWeek.setDate(startOfWeek.getDate() - 7);

  const prevMonth = new Date(startOfMonth);
  prevMonth.setDate(startOfMonth.getDate() - 30);

  const prevQuarter = new Date(startOfQuarter);
  prevQuarter.setDate(startOfQuarter.getDate() - 90);

  const supportInquiryFilter: Prisma.InquiryWhereInput = {
    NOT: {
      subject: {
        contains: "SKEAP application",
        mode: "insensitive" as const,
      },
    },
  };

  const [
    openInquiryCount,
    pendingSubmissionCount,
    inquiries,
    openToday,
    openYesterday,
    openThisWeek,
    openLastWeek,
    openThisMonth,
    openLastMonth,
    openThisQuarter,
    openLastQuarter,
    totalToday,
    totalYesterday,
    totalThisWeek,
    totalLastWeek,
    totalThisMonth,
    totalLastMonth,
    totalThisQuarter,
    totalLastQuarter,
    resolvedToday,
    resolvedYesterday,
    resolvedThisWeek,
    resolvedLastWeek,
    resolvedThisMonth,
    resolvedLastMonth,
    resolvedThisQuarter,
    resolvedLastQuarter,
  ] = await Promise.all([
    prisma.inquiry.count({ where: { ...supportInquiryFilter, isResolved: false } }),
    prisma.submission.count({ where: { status: "PENDING" } }),
    prisma.inquiry.findMany({
      where: supportInquiryFilter,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
    }),
    prisma.inquiry.count({ where: { ...supportInquiryFilter, isResolved: false, createdAt: { gte: startOfToday } } }),
    prisma.inquiry.count({
      where: { ...supportInquiryFilter, isResolved: false, createdAt: { gte: prevDay, lt: startOfToday } },
    }),
    prisma.inquiry.count({ where: { ...supportInquiryFilter, isResolved: false, createdAt: { gte: startOfWeek } } }),
    prisma.inquiry.count({
      where: { ...supportInquiryFilter, isResolved: false, createdAt: { gte: prevWeek, lt: startOfWeek } },
    }),
    prisma.inquiry.count({ where: { ...supportInquiryFilter, isResolved: false, createdAt: { gte: startOfMonth } } }),
    prisma.inquiry.count({
      where: { ...supportInquiryFilter, isResolved: false, createdAt: { gte: prevMonth, lt: startOfMonth } },
    }),
    prisma.inquiry.count({ where: { ...supportInquiryFilter, isResolved: false, createdAt: { gte: startOfQuarter } } }),
    prisma.inquiry.count({
      where: { ...supportInquiryFilter, isResolved: false, createdAt: { gte: prevQuarter, lt: startOfQuarter } },
    }),
    prisma.inquiry.count({ where: { ...supportInquiryFilter, createdAt: { gte: startOfToday } } }),
    prisma.inquiry.count({ where: { ...supportInquiryFilter, createdAt: { gte: prevDay, lt: startOfToday } } }),
    prisma.inquiry.count({ where: { ...supportInquiryFilter, createdAt: { gte: startOfWeek } } }),
    prisma.inquiry.count({ where: { ...supportInquiryFilter, createdAt: { gte: prevWeek, lt: startOfWeek } } }),
    prisma.inquiry.count({ where: { ...supportInquiryFilter, createdAt: { gte: startOfMonth } } }),
    prisma.inquiry.count({ where: { ...supportInquiryFilter, createdAt: { gte: prevMonth, lt: startOfMonth } } }),
    prisma.inquiry.count({ where: { ...supportInquiryFilter, createdAt: { gte: startOfQuarter } } }),
    prisma.inquiry.count({ where: { ...supportInquiryFilter, createdAt: { gte: prevQuarter, lt: startOfQuarter } } }),
    prisma.inquiry.count({ where: { ...supportInquiryFilter, isResolved: true, respondedAt: { gte: startOfToday } } }),
    prisma.inquiry.count({
      where: { ...supportInquiryFilter, isResolved: true, respondedAt: { gte: prevDay, lt: startOfToday } },
    }),
    prisma.inquiry.count({ where: { ...supportInquiryFilter, isResolved: true, respondedAt: { gte: startOfWeek } } }),
    prisma.inquiry.count({
      where: { ...supportInquiryFilter, isResolved: true, respondedAt: { gte: prevWeek, lt: startOfWeek } },
    }),
    prisma.inquiry.count({ where: { ...supportInquiryFilter, isResolved: true, respondedAt: { gte: startOfMonth } } }),
    prisma.inquiry.count({
      where: { ...supportInquiryFilter, isResolved: true, respondedAt: { gte: prevMonth, lt: startOfMonth } },
    }),
    prisma.inquiry.count({ where: { ...supportInquiryFilter, isResolved: true, respondedAt: { gte: startOfQuarter } } }),
    prisma.inquiry.count({
      where: { ...supportInquiryFilter, isResolved: true, respondedAt: { gte: prevQuarter, lt: startOfQuarter } },
    }),
  ]);

  const periodLabels: Record<TimePeriod, string> = {
    Today: "today",
    Week: "this week",
    Month: "this month",
    Quarter: "this quarter",
  };

  const openDelta = {
    Today: formatDelta(openToday, openYesterday),
    Week: formatDelta(openThisWeek, openLastWeek),
    Month: formatDelta(openThisMonth, openLastMonth),
    Quarter: formatDelta(openThisQuarter, openLastQuarter),
  };

  const newDelta = {
    Today: formatDelta(totalToday, totalYesterday),
    Week: formatDelta(totalThisWeek, totalLastWeek),
    Month: formatDelta(totalThisMonth, totalLastMonth),
    Quarter: formatDelta(totalThisQuarter, totalLastQuarter),
  };

  const resolvedDelta = {
    Today: formatDelta(resolvedToday, resolvedYesterday),
    Week: formatDelta(resolvedThisWeek, resolvedLastWeek),
    Month: formatDelta(resolvedThisMonth, resolvedLastMonth),
    Quarter: formatDelta(resolvedThisQuarter, resolvedLastQuarter),
  };

  const responseRate = {
    Today: totalToday === 0 ? 0 : Math.round((resolvedToday / totalToday) * 100),
    Week: totalThisWeek === 0 ? 0 : Math.round((resolvedThisWeek / totalThisWeek) * 100),
    Month: totalThisMonth === 0 ? 0 : Math.round((resolvedThisMonth / totalThisMonth) * 100),
    Quarter: totalThisQuarter === 0 ? 0 : Math.round((resolvedThisQuarter / totalThisQuarter) * 100),
  };

  const responseRateDelta = {
    Today: formatDelta(responseRate.Today, totalYesterday === 0 ? 0 : Math.round((resolvedYesterday / totalYesterday) * 100)),
    Week: formatDelta(responseRate.Week, totalLastWeek === 0 ? 0 : Math.round((resolvedLastWeek / totalLastWeek) * 100)),
    Month: formatDelta(responseRate.Month, totalLastMonth === 0 ? 0 : Math.round((resolvedLastMonth / totalLastMonth) * 100)),
    Quarter: formatDelta(responseRate.Quarter, totalLastQuarter === 0 ? 0 : Math.round((resolvedLastQuarter / totalLastQuarter) * 100)),
  };

  const statsByPeriod: Record<TimePeriod, StatItem[]> = {
    Today: [
      {
        label: "Open inquiries",
        value: `${openToday}`,
        sub: `open ${periodLabels.Today}`,
        delta: openDelta.Today.delta,
        up: openDelta.Today.up,
        iconName: "Inbox",
      },
      {
        label: "New inquiries",
        value: `${totalToday}`,
        sub: `created ${periodLabels.Today}`,
        delta: newDelta.Today.delta,
        up: newDelta.Today.up,
        iconName: "CalendarDays",
      },
      {
        label: "Resolved inquiries",
        value: `${resolvedToday}`,
        sub: `responded ${periodLabels.Today}`,
        delta: resolvedDelta.Today.delta,
        up: resolvedDelta.Today.up,
        iconName: "Check",
      },
      {
        label: "Response rate",
        value: `${responseRate.Today}%`,
        sub: `of today's inquiries`,
        delta: responseRateDelta.Today.delta,
        up: responseRateDelta.Today.up,
        iconName: "Users",
      },
    ],
    Week: [
      {
        label: "Open inquiries",
        value: `${openThisWeek}`,
        sub: `open ${periodLabels.Week}`,
        delta: openDelta.Week.delta,
        up: openDelta.Week.up,
        iconName: "Inbox",
      },
      {
        label: "New inquiries",
        value: `${totalThisWeek}`,
        sub: `created ${periodLabels.Week}`,
        delta: newDelta.Week.delta,
        up: newDelta.Week.up,
        iconName: "CalendarDays",
      },
      {
        label: "Resolved inquiries",
        value: `${resolvedThisWeek}`,
        sub: `responded ${periodLabels.Week}`,
        delta: resolvedDelta.Week.delta,
        up: resolvedDelta.Week.up,
        iconName: "Check",
      },
      {
        label: "Response rate",
        value: `${responseRate.Week}%`,
        sub: `of this week's inquiries`,
        delta: responseRateDelta.Week.delta,
        up: responseRateDelta.Week.up,
        iconName: "Users",
      },
    ],
    Month: [
      {
        label: "Open inquiries",
        value: `${openThisMonth}`,
        sub: `open ${periodLabels.Month}`,
        delta: openDelta.Month.delta,
        up: openDelta.Month.up,
        iconName: "Inbox",
      },
      {
        label: "New inquiries",
        value: `${totalThisMonth}`,
        sub: `created ${periodLabels.Month}`,
        delta: newDelta.Month.delta,
        up: newDelta.Month.up,
        iconName: "CalendarDays",
      },
      {
        label: "Resolved inquiries",
        value: `${resolvedThisMonth}`,
        sub: `responded ${periodLabels.Month}`,
        delta: resolvedDelta.Month.delta,
        up: resolvedDelta.Month.up,
        iconName: "Check",
      },
      {
        label: "Response rate",
        value: `${responseRate.Month}%`,
        sub: `of this month's inquiries`,
        delta: responseRateDelta.Month.delta,
        up: responseRateDelta.Month.up,
        iconName: "Users",
      },
    ],
    Quarter: [
      {
        label: "Open inquiries",
        value: `${openThisQuarter}`,
        sub: `open ${periodLabels.Quarter}`,
        delta: openDelta.Quarter.delta,
        up: openDelta.Quarter.up,
        iconName: "Inbox",
      },
      {
        label: "New inquiries",
        value: `${totalThisQuarter}`,
        sub: `created ${periodLabels.Quarter}`,
        delta: newDelta.Quarter.delta,
        up: newDelta.Quarter.up,
        iconName: "CalendarDays",
      },
      {
        label: "Resolved inquiries",
        value: `${resolvedThisQuarter}`,
        sub: `responded ${periodLabels.Quarter}`,
        delta: resolvedDelta.Quarter.delta,
        up: resolvedDelta.Quarter.up,
        iconName: "Check",
      },
      {
        label: "Response rate",
        value: `${responseRate.Quarter}%`,
        sub: `of this quarter's inquiries`,
        delta: responseRateDelta.Quarter.delta,
        up: responseRateDelta.Quarter.up,
        iconName: "Users",
      },
    ],
  };

  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <InquiriesPageClient
      dateLabel={dateLabel}
      openInquiryCount={openInquiryCount}
      pendingSubmissionCount={pendingSubmissionCount}
      statsByPeriod={statsByPeriod}
      inquiries={inquiries.map((inquiry: any) => ({
        ...inquiry,
        createdAt: inquiry.createdAt.toISOString(),
        respondedAt: inquiry.respondedAt?.toISOString() ?? null,
      }))}
    />
  );
}
