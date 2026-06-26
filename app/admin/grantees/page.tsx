import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminGranteesPageClient from "../AdminGranteesPageClient";
import type { GranteeTableRow } from "../grantees/GranteeStatusTable";

export default async function AdminGranteesPage() {
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
  const next30Days = new Date(now);
  next30Days.setDate(now.getDate() + 30);
  const next60Days = new Date(now);
  next60Days.setDate(now.getDate() + 60);

  const [
    grantees,
    openInquiryCount,
    pendingSubmissionCount,
    upcomingEventCount,
    newGranteesToday,
    newGranteesYesterday,
    newGranteesThisWeek,
    newGranteesLastWeek,
    newGranteesThisMonth,
    newGranteesLastMonth,
    newGranteesThisQuarter,
    newGranteesLastQuarter,
    newOpenInquiriesToday,
    newOpenInquiriesYesterday,
    newOpenInquiriesThisWeek,
    newOpenInquiriesLastWeek,
    newOpenInquiriesThisMonth,
    newOpenInquiriesLastMonth,
    newOpenInquiriesThisQuarter,
    newOpenInquiriesLastQuarter,
    newPendingSubmissionsToday,
    newPendingSubmissionsYesterday,
    newPendingSubmissionsThisWeek,
    newPendingSubmissionsLastWeek,
    newPendingSubmissionsThisMonth,
    newPendingSubmissionsLastMonth,
    newPendingSubmissionsThisQuarter,
    newPendingSubmissionsLastQuarter,
    upcomingEventsNext30Days,
    upcomingEventsNext60Days,
  ] = await Promise.all([
    prisma.grantee.findMany({
      orderBy: { updatedAt: "desc" },
      include: { user: true },
    }),
    prisma.inquiry.count({ where: { isResolved: false } }),
    prisma.submission.count({ where: { status: "PENDING" } }),
    prisma.event.count({
      where: {
        status: { in: ["UPCOMING", "REGISTRATION_OPEN"] },
      },
    }),
    prisma.grantee.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.grantee.count({ where: { createdAt: { gte: prevDay, lt: startOfToday } } }),
    prisma.grantee.count({ where: { createdAt: { gte: startOfWeek } } }),
    prisma.grantee.count({ where: { createdAt: { gte: prevWeek, lt: startOfWeek } } }),
    prisma.grantee.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.grantee.count({ where: { createdAt: { gte: prevMonth, lt: startOfMonth } } }),
    prisma.grantee.count({ where: { createdAt: { gte: startOfQuarter } } }),
    prisma.grantee.count({ where: { createdAt: { gte: prevQuarter, lt: startOfQuarter } } }),
    prisma.inquiry.count({ where: { isResolved: false, createdAt: { gte: startOfToday } } }),
    prisma.inquiry.count({ where: { isResolved: false, createdAt: { gte: prevDay, lt: startOfToday } } }),
    prisma.inquiry.count({ where: { isResolved: false, createdAt: { gte: startOfWeek } } }),
    prisma.inquiry.count({ where: { isResolved: false, createdAt: { gte: prevWeek, lt: startOfWeek } } }),
    prisma.inquiry.count({ where: { isResolved: false, createdAt: { gte: startOfMonth } } }),
    prisma.inquiry.count({ where: { isResolved: false, createdAt: { gte: prevMonth, lt: startOfMonth } } }),
    prisma.inquiry.count({ where: { isResolved: false, createdAt: { gte: startOfQuarter } } }),
    prisma.inquiry.count({ where: { isResolved: false, createdAt: { gte: prevQuarter, lt: startOfQuarter } } }),
    prisma.submission.count({ where: { status: "PENDING", submittedAt: { gte: startOfToday } } }),
    prisma.submission.count({ where: { status: "PENDING", submittedAt: { gte: prevDay, lt: startOfToday } } }),
    prisma.submission.count({ where: { status: "PENDING", submittedAt: { gte: startOfWeek } } }),
    prisma.submission.count({ where: { status: "PENDING", submittedAt: { gte: prevWeek, lt: startOfWeek } } }),
    prisma.submission.count({ where: { status: "PENDING", submittedAt: { gte: startOfMonth } } }),
    prisma.submission.count({ where: { status: "PENDING", submittedAt: { gte: prevMonth, lt: startOfMonth } } }),
    prisma.submission.count({ where: { status: "PENDING", submittedAt: { gte: startOfQuarter } } }),
    prisma.submission.count({ where: { status: "PENDING", submittedAt: { gte: prevQuarter, lt: startOfQuarter } } }),
    prisma.event.count({
      where: {
        status: { in: ["UPCOMING", "REGISTRATION_OPEN"] },
        eventDate: { gte: now, lt: next30Days },
      },
    }),
    prisma.event.count({
      where: {
        status: { in: ["UPCOMING", "REGISTRATION_OPEN"] },
        eventDate: { gte: next30Days, lt: next60Days },
      },
    }),
  ]);

  const formatDelta = (current: number, previous: number) => {
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
  };

  const granteeDelta = {
    Today: formatDelta(newGranteesToday, newGranteesYesterday),
    Week: formatDelta(newGranteesThisWeek, newGranteesLastWeek),
    Month: formatDelta(newGranteesThisMonth, newGranteesLastMonth),
    Quarter: formatDelta(newGranteesThisQuarter, newGranteesLastQuarter),
  };

  const inquiryDelta = {
    Today: formatDelta(newOpenInquiriesToday, newOpenInquiriesYesterday),
    Week: formatDelta(newOpenInquiriesThisWeek, newOpenInquiriesLastWeek),
    Month: formatDelta(newOpenInquiriesThisMonth, newOpenInquiriesLastMonth),
    Quarter: formatDelta(newOpenInquiriesThisQuarter, newOpenInquiriesLastQuarter),
  };

  const submissionDelta = {
    Today: formatDelta(newPendingSubmissionsToday, newPendingSubmissionsYesterday),
    Week: formatDelta(newPendingSubmissionsThisWeek, newPendingSubmissionsLastWeek),
    Month: formatDelta(newPendingSubmissionsThisMonth, newPendingSubmissionsLastMonth),
    Quarter: formatDelta(newPendingSubmissionsThisQuarter, newPendingSubmissionsLastQuarter),
  };

  const pendingDocumentCount = pendingSubmissionCount;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const appUser = await prisma.user.findUnique({
    where: { authId: user.id },
    select: { fullName: true, role: true, avatarUrl: true },
  });

  if (!appUser) {
    redirect("/login");
  }

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const countsByPeriod = {
    Today: {
      grantees: newGranteesToday,
      submissions: newPendingSubmissionsToday,
      inquiries: newOpenInquiriesToday,
    },
    Week: {
      grantees: newGranteesThisWeek,
      submissions: newPendingSubmissionsThisWeek,
      inquiries: newOpenInquiriesThisWeek,
    },
    Month: {
      grantees: newGranteesThisMonth,
      submissions: newPendingSubmissionsThisMonth,
      inquiries: newOpenInquiriesThisMonth,
    },
    Quarter: {
      grantees: newGranteesThisQuarter,
      submissions: newPendingSubmissionsThisQuarter,
      inquiries: newOpenInquiriesThisQuarter,
    },
  };

  const periodLabels: Record<"Today" | "Week" | "Month" | "Quarter", string> = {
    Today: "new today",
    Week: "new this week",
    Month: "new this month",
    Quarter: "new this quarter",
  };

  const statsByPeriod: Record<"Today" | "Week" | "Month" | "Quarter", {
    label: string;
    value: string;
    sub: string;
    delta: string;
    up: boolean;
    iconName: "Users" | "CalendarDays" | "Inbox" | "Check";
  }[]> = {
    Today: [
      {
        label: "Total Grantees",
        value: `${countsByPeriod.Today.grantees}`,
        sub: periodLabels.Today,
        delta: granteeDelta.Today.delta,
        up: granteeDelta.Today.up,
        iconName: "Users" as const,
      },
      {
        label: "Pending Submissions",
        value: `${countsByPeriod.Today.submissions}`,
        sub: periodLabels.Today,
        delta: submissionDelta.Today.delta,
        up: submissionDelta.Today.up,
        iconName: "Check" as const,
      },
      {
        label: "Open Inquiries",
        value: `${countsByPeriod.Today.inquiries}`,
        sub: periodLabels.Today,
        delta: inquiryDelta.Today.delta,
        up: inquiryDelta.Today.up,
        iconName: "Inbox" as const,
      },
      {
        label: "Pending Document Reviews",
        value: `${countsByPeriod.Today.submissions}`,
        sub: periodLabels.Today,
        delta: submissionDelta.Today.delta,
        up: submissionDelta.Today.up,
        iconName: "Check" as const,
      },
    ],
    Week: [
      {
        label: "Total Grantees",
        value: `${countsByPeriod.Week.grantees}`,
        sub: periodLabels.Week,
        delta: granteeDelta.Week.delta,
        up: granteeDelta.Week.up,
        iconName: "Users" as const,
      },
      {
        label: "Pending Submissions",
        value: `${countsByPeriod.Week.submissions}`,
        sub: periodLabels.Week,
        delta: submissionDelta.Week.delta,
        up: submissionDelta.Week.up,
        iconName: "Check" as const,
      },
      {
        label: "Open Inquiries",
        value: `${countsByPeriod.Week.inquiries}`,
        sub: periodLabels.Week,
        delta: inquiryDelta.Week.delta,
        up: inquiryDelta.Week.up,
        iconName: "Inbox" as const,
      },
      {
        label: "Pending Document Reviews",
        value: `${countsByPeriod.Week.submissions}`,
        sub: periodLabels.Week,
        delta: submissionDelta.Week.delta,
        up: submissionDelta.Week.up,
        iconName: "Check" as const,
      },
    ],
    Month: [
      {
        label: "Total Grantees",
        value: `${countsByPeriod.Month.grantees}`,
        sub: periodLabels.Month,
        delta: granteeDelta.Month.delta,
        up: granteeDelta.Month.up,
        iconName: "Users" as const,
      },
      {
        label: "Pending Submissions",
        value: `${countsByPeriod.Month.submissions}`,
        sub: periodLabels.Month,
        delta: submissionDelta.Month.delta,
        up: submissionDelta.Month.up,
        iconName: "Check" as const,
      },
      {
        label: "Open Inquiries",
        value: `${countsByPeriod.Month.inquiries}`,
        sub: periodLabels.Month,
        delta: inquiryDelta.Month.delta,
        up: inquiryDelta.Month.up,
        iconName: "Inbox" as const,
      },
      {
        label: "Pending Document Reviews",
        value: `${countsByPeriod.Month.submissions}`,
        sub: periodLabels.Month,
        delta: submissionDelta.Month.delta,
        up: submissionDelta.Month.up,
        iconName: "Check" as const,
      },
    ],
    Quarter: [
      {
        label: "Total Grantees",
        value: `${countsByPeriod.Quarter.grantees}`,
        sub: periodLabels.Quarter,
        delta: granteeDelta.Quarter.delta,
        up: granteeDelta.Quarter.up,
        iconName: "Users" as const,
      },
      {
        label: "Pending Submissions",
        value: `${countsByPeriod.Quarter.submissions}`,
        sub: periodLabels.Quarter,
        delta: submissionDelta.Quarter.delta,
        up: submissionDelta.Quarter.up,
        iconName: "Check" as const,
      },
      {
        label: "Open Inquiries",
        value: `${countsByPeriod.Quarter.inquiries}`,
        sub: periodLabels.Quarter,
        delta: inquiryDelta.Quarter.delta,
        up: inquiryDelta.Quarter.up,
        iconName: "Inbox" as const,
      },
      {
        label: "Pending Document Reviews",
        value: `${countsByPeriod.Quarter.submissions}`,
        sub: periodLabels.Quarter,
        delta: submissionDelta.Quarter.delta,
        up: submissionDelta.Quarter.up,
        iconName: "Check" as const,
      },
    ],
  };

  const granteeRows: GranteeTableRow[] = grantees.map((grantee) => ({
    id: grantee.id,
    fullName: grantee.user.fullName,
    email: grantee.user.email,
    school: grantee.school,
    yearLevel: grantee.yearLevel,
    status: grantee.status,
    generalAverage: grantee.generalAverage,
    dateEnrolled: grantee.dateEnrolled.toISOString(),
    updatedAt: grantee.updatedAt.toISOString(),
  }));

  const initials = appUser.fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

  return (
    <AdminGranteesPageClient
      dateLabel={dateLabel}
      openInquiryCount={openInquiryCount}
      pendingSubmissionCount={pendingSubmissionCount}
      stats={statsByPeriod.Month}
      statsByPeriod={statsByPeriod}
      grantees={granteeRows}
    />
  );
}
