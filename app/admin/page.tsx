import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { prisma, getMonthlyProfilingRegistrationCounts } from "@/lib/prisma";
import { getScholarDistributionAnalytics } from "@/lib/admin-scholar-analytics";
import AdminDashboardPageClient from "./AdminDashboardPageClient";
import { requireRole } from "@/lib/auth";

export default async function SKOfficialDashboardPage() {
  const adminUser = await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);
  if (adminUser.role === Role.SUPER_ADMIN) {
    redirect("/system-admin");
  }

  const supportInquiryFilter = {
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
    profilingMonthlyRows,
    scholarAnalytics,
    recentInquiries,
    pendingReviews,
  ] = await Promise.all([
    prisma.inquiry.count({
      where: { ...supportInquiryFilter, isResolved: false },
    }),
    prisma.submission.count({
      where: { status: "PENDING" },
    }),
    getMonthlyProfilingRegistrationCounts(6),
    getScholarDistributionAnalytics(),
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
    prisma.submission.findMany({
      where: { status: "PENDING" },
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      take: 3,
      select: {
        id: true,
        semester: true,
        coeFileUrl: true,
        gradeFileUrl: true,
        submittedAt: true,
        grantee: {
          select: {
            school: true,
            yearLevel: true,
            user: { select: { fullName: true } },
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

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 sm:gap-8">
      <AdminDashboardPageClient
        dateLabel={dateLabel}
        openInquiryCount={openInquiryCount}
        pendingSubmissionCount={pendingSubmissionCount}
        profilingSeries={profilingSeries}
        profilingMonths={profilingMonths}
        scholarAnalytics={scholarAnalytics}
        recentInquiries={recentInquiries.map((inquiry) => ({
          ...inquiry,
          createdAt: inquiry.createdAt.toISOString(),
        }))}
        pendingReviews={pendingReviews.map((review) => ({
          ...review,
          submittedAt: review.submittedAt.toISOString(),
        }))}
      />
    </div>
  );
}
