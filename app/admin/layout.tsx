import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma, getProfilingRegistrationCount, getProfilingRegistrationCountByStatus, getProfilingRegistrationCountByStatusSince } from "@/lib/prisma";
import AdminSidebar from "./AdminSidebar";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);

  const supportInquiryFilter = {
    NOT: {
      subject: {
        contains: "SKEAP application",
        mode: "insensitive" as const,
      },
    },
  };

  const subjectWhere = { subject: { contains: "SKEAP application", mode: "insensitive" as const } };
  const excludeCancelled = { reviewStatus: { contains: "cancel", mode: "insensitive" as const } };
  const excludeApproved = { reviewStatus: { contains: "approve", mode: "insensitive" as const } };

  const statusOrWhere = (patterns: string[]) => {
    return {
      OR: patterns.flatMap((pattern) => [
        { reviewStatus: { contains: pattern, mode: "insensitive" as const } },
        { response: { contains: pattern, mode: "insensitive" as const } },
      ]),
    } as const;
  };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [openInquiryCount, skeapApplicationCount, pendingDocumentCount, profilingRegistrationCount, newGranteesToday, approvedMemberCountToday] =
    await Promise.all([
      prisma.inquiry.count({
        where: { ...supportInquiryFilter, isResolved: false },
      }),
      prisma.inquiry.count({
        where: {
          ...subjectWhere,
          NOT: [excludeCancelled, excludeApproved],
          AND: [statusOrWhere(["pending", "return", "resubm", "respond"])],
        },
      }),
      prisma.submission.count({ where: { status: "PENDING" } }),
      getProfilingRegistrationCount(),
      prisma.grantee.count({ where: { createdAt: { gte: startOfToday } } }),
      getProfilingRegistrationCountByStatusSince("Approved", startOfToday),
    ]);
  // compute today's counts for sidebar badges (show only items added today)
  const [
    openInquiryCountToday,
    skeapApplicationCountToday,
    pendingDocumentCountToday,
    profilingRegistrationCountToday,
  ] = await Promise.all([
    prisma.inquiry.count({ where: { ...supportInquiryFilter, isResolved: false, createdAt: { gte: startOfToday } } }),
    prisma.inquiry.count({
      where: {
        ...subjectWhere,
        NOT: [excludeCancelled, excludeApproved],
        AND: [statusOrWhere(["pending", "return", "resubm", "respond"])],
        createdAt: { gte: startOfToday },
      },
    }),
    prisma.submission.count({ where: { status: "PENDING", submittedAt: { gte: startOfToday } } }),
    prisma.profilingRegistration.count({ where: { submittedAt: { gte: startOfToday } } }),
  ]);
  return (
    <div className="h-screen w-screen overflow-hidden bg-[#F8FBFF] text-slate-950">
      <div className="mx-auto flex h-full max-w-[1480px]">
        <AdminSidebar
          openInquiryCount={openInquiryCountToday}
          skeapApplicationCount={skeapApplicationCountToday}
          pendingDocumentCount={pendingDocumentCountToday}
          profilingRegistrationCount={profilingRegistrationCountToday}
          newGranteesToday={newGranteesToday}
          approvedMemberCount={approvedMemberCountToday}
        />
        <main className="flex-1 h-full overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
