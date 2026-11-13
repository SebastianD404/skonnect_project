import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
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

  const [openInquiryCount, pendingSubmissionCount, scholarAnalytics] = await Promise.all([
    prisma.inquiry.count({
      where: { ...supportInquiryFilter, isResolved: false },
    }),
    prisma.submission.count({
      where: { status: "PENDING" },
    }),
    getScholarDistributionAnalytics(),
  ]);

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
        scholarAnalytics={scholarAnalytics}
      />
    </div>
  );
}
