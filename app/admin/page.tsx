import { redirect } from "next/navigation";
import { prisma, getProfilingRegistrationCount } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import AdminDashboardPageClient from "./AdminDashboardPageClient";

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

  const [
    grantees,
    openInquiryCount,
    upcomingEventCount,
    pendingSubmissionCount,
    profilingRegistrationCount,
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
      where: { isResolved: false },
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
      where: { isResolved: false },
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
    prisma.inquiry.count({ where: { createdAt: { gte: last30Days } } }),
    prisma.inquiry.count({ where: { createdAt: { gte: prev30Days, lt: last30Days } } }),
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

  const appUser = await prisma.user.findUnique({
    where: { authId: user.id },
    select: { fullName: true, role: true, avatarUrl: true },
  });

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
