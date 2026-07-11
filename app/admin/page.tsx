import { redirect } from "next/navigation";
import { prisma, getProfilingRegistrationCount, getMonthlyProfilingRegistrationCounts } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import AdminDashboardPageClient from "./AdminDashboardPageClient";
import { ensureProfile } from "@/lib/auth";

export default async function SKOfficialDashboardPage() {
  const now = new Date();
  const last30Days = new Date(now);
  last30Days.setDate(now.getDate() - 30);
  const prev30Days = new Date(now);
  prev30Days.setDate(now.getDate() - 60);
  const next30Days = new Date(now);
  next30Days.setDate(now.getDate() + 30);
  const next60Days = new Date(now);
  next60Days.setDate(now.getDate() + 60);

  const supportInquiryFilter = {
    NOT: {
      subject: {
        contains: "SKEAP application",
        mode: "insensitive" as const,
      },
    },
  };

  const [
    grantees,
    openInquiryCount,
    upcomingEventCount,
    pendingSubmissionCount,
    profilingRegistrationCount,
    profilingMonthlyRows,
    upcomingEvents,
    recentInquiries,
    newGranteesLast30Days,
    newGranteesPrev30Days,
    newOpenInquiriesLast30Days,
    newOpenInquiriesPrev30Days,
    newPendingSubmissionsLast30Days,
    newPendingSubmissionsPrev30Days,
    upcomingEventsNext30Days,
    upcomingEventsNext60Days,
  ] = await Promise.all([
    prisma.grantee.findMany({
      take: 6,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        status: true,
        yearLevel: true,
        school: true,
        generalAverage: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
            role: true,
          },
        },
      },
    }),
    prisma.inquiry.count({
      where: { ...supportInquiryFilter, isResolved: false },
    }),
    prisma.event.count({
      where: {
        status: {
          in: ["UPCOMING", "REGISTRATION_OPEN"],
        },
      },
    }),
    prisma.submission.count({
      where: { status: "PENDING" },
    }),
    getProfilingRegistrationCount(),
    getMonthlyProfilingRegistrationCounts(6),
    prisma.event.findMany({
      take: 4,
      orderBy: { eventDate: "asc" },
      where: {
        status: {
          in: ["UPCOMING", "REGISTRATION_OPEN"],
        },
      },
      select: {
        id: true,
        title: true,
        description: true,
        venue: true,
        eventDate: true,
        status: true,
        filledSlots: true,
        maxSlots: true,
      },
    }),
    prisma.inquiry.findMany({
      take: 4,
      orderBy: { createdAt: "desc" },
      where: { ...supportInquiryFilter, isResolved: false },
      select: {
        id: true,
        subject: true,
        message: true,
        createdAt: true,
        language: true,
        user: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
    }),
    prisma.grantee.count({ where: { createdAt: { gte: last30Days } } }),
    prisma.grantee.count({ where: { createdAt: { gte: prev30Days, lt: last30Days } } }),
    prisma.inquiry.count({ where: { ...supportInquiryFilter, createdAt: { gte: last30Days } } }),
    prisma.inquiry.count({ where: { ...supportInquiryFilter, createdAt: { gte: prev30Days, lt: last30Days } } }),
    prisma.submission.count({ where: { submittedAt: { gte: last30Days }, status: "PENDING" } }),
    prisma.submission.count({ where: { submittedAt: { gte: prev30Days, lt: last30Days }, status: "PENDING" } }),
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

  // Build a contiguous last-N-months series (labels + counts)
  const monthsToShow = 6;
  const rows = Array.isArray(profilingMonthlyRows) ? profilingMonthlyRows : [];

  // Determine end month from DB rows if available, otherwise use current month
  let end = new Date();
  end.setDate(1);
  end.setHours(0, 0, 0, 0);

  if (rows.length > 0) {
    // find latest month key returned by DB (normalize to YYYY-MM)
    const maxKey = rows
      .map((r) => String(r.month).slice(0, 7))
      .sort()
      .pop();
    if (maxKey) {
      const [y, m] = maxKey.split("-");
      const parsed = new Date(Number(y), Number(m) - 1, 1);
      if (!isNaN(parsed.getTime())) {
        end = parsed;
      }
    }
  }

  const start = new Date(end);
  start.setMonth(end.getMonth() - (monthsToShow - 1));

  const profilingMonths: string[] = [];
  const profilingSeries: number[] = [];

  for (let i = 0; i < monthsToShow; i++) {
    const d = new Date(start);
    d.setMonth(start.getMonth() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    profilingMonths.push(d.toLocaleString("en-US", { month: "short" }));
    const found = rows.find((r) => String(r.month).slice(0, 7) === key);
    profilingSeries.push(found ? Number(found.count) : 0);
  }

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

  const granteeDelta = formatDelta(newGranteesLast30Days, newGranteesPrev30Days);
  const inquiryDelta = formatDelta(newOpenInquiriesLast30Days, newOpenInquiriesPrev30Days);
  const submissionDelta = formatDelta(newPendingSubmissionsLast30Days, newPendingSubmissionsPrev30Days);
  const eventDelta = formatDelta(upcomingEventsNext30Days, upcomingEventsNext60Days);

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const stats = [
    {
      label: "Active Grantees",
      value: `${grantees.length}`,
      sub: "new this month",
      delta: granteeDelta.delta,
      up: granteeDelta.up,
      iconName: "Users" as const,
    },
    {
      label: "Upcoming Events",
      value: `${upcomingEventCount}`,
      sub: "next 30 days",
      delta: eventDelta.delta,
      up: eventDelta.up,
      iconName: "CalendarDays" as const,
    },
    {
      label: "Open Inquiries",
      value: `${openInquiryCount}`,
      sub: "new last 30 days",
      delta: inquiryDelta.delta,
      up: inquiryDelta.up,
      iconName: "Inbox" as const,
    },
    {
      label: "Pending Document Reviews",
      value: `${pendingSubmissionCount}`,
      sub: "new last 30 days",
      delta: submissionDelta.delta,
      up: submissionDelta.up,
      iconName: "Check" as const,
    },
  ];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const appUser = await ensureProfile(user);

  if (!appUser) {
    redirect("/login");
  }

  return (
    <AdminDashboardPageClient
      dateLabel={dateLabel}
      openInquiryCount={openInquiryCount}
      pendingSubmissionCount={pendingSubmissionCount}
      stats={stats}
      profilingRegistrationCount={profilingRegistrationCount}
      profilingSeries={profilingSeries}
      profilingMonths={profilingMonths}
      upcomingEvents={upcomingEvents.map((event) => ({
        ...event,
        eventDate: event.eventDate.toISOString(),
      }))}
      recentInquiries={recentInquiries.map((inquiry) => ({
        ...inquiry,
        createdAt: inquiry.createdAt.toISOString(),
      }))}
    />
  );
}
