import { redirect } from "next/navigation";
import { prisma, getProfilingRegistrationCount, getMonthlyProfilingRegistrationCounts } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import AdminDashboardPageClient from "./AdminDashboardPageClient";
import { ensureProfile } from "@/lib/auth";

export default async function SKOfficialDashboardPage() {
  const supportInquiryFilter = {
    NOT: {
      subject: {
        contains: "SKEAP application",
        mode: "insensitive" as const,
      },
    },
  };

  const [
    totalGranteesCount,
    openInquiryCount,
    pendingSubmissionCount,
    skeapApplicationCount,
    profilingRegistrationCount,
    profilingMonthlyRows,
    recentInquiries,
  ] = await Promise.all([
    prisma.grantee.count({ where: { status: { in: ["ACTIVE", "PROBATIONARY"] } } }),
    prisma.inquiry.count({
      where: { ...supportInquiryFilter, isResolved: false },
    }),
    prisma.submission.count({
      where: { status: "PENDING" },
    }),
    prisma.inquiry.count({
      where: {
        subject: { contains: "SKEAP application", mode: "insensitive" as const },
        NOT: [
          { reviewStatus: { contains: "cancel", mode: "insensitive" as const } },
          { reviewStatus: { contains: "approve", mode: "insensitive" as const } },
        ],
        AND: [
          {
            OR: [
              { reviewStatus: { contains: "pending", mode: "insensitive" as const } },
              { reviewStatus: { contains: "return", mode: "insensitive" as const } },
              { reviewStatus: { contains: "resubm", mode: "insensitive" as const } },
              { reviewStatus: { contains: "respond", mode: "insensitive" as const } },
            ],
          },
        ],
      },
    }),
    getProfilingRegistrationCount(),
    getMonthlyProfilingRegistrationCounts(6),
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

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const stats = [
    {
      label: "Total Grantees",
      value: `${totalGranteesCount}`,
      sub: "currently active",
      href: "/admin/grantees",
      accent: "cyan" as const,
      iconName: "Users" as const,
    },
    {
      label: "Pending Applications",
      value: `${skeapApplicationCount}`,
      sub: "awaiting review",
      href: "/admin/skeap-applications",
      accent: "amber" as const,
      iconName: "FileText" as const,
    },
    {
      label: "Open Inquiries",
      value: `${openInquiryCount}`,
      sub: "unresolved",
      href: "/admin/inquiries",
      accent: "amber" as const,
      iconName: "Inbox" as const,
    },
    {
      label: "Document Reviews",
      value: `${pendingSubmissionCount}`,
      sub: "needs action",
      href: "/admin/submissions",
      accent: "amber" as const,
      iconName: "CheckSquare" as const,
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
      recentInquiries={recentInquiries.map((inquiry: any) => ({
        ...inquiry,
        createdAt: inquiry.createdAt.toISOString(),
      }))}
    />
  );
}
