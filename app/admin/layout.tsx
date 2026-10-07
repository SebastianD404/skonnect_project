import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma, getProfilingRegistrationCountByStatusSince } from "@/lib/prisma";
import { skeapStatusWhere } from "@/lib/skeap-applications";
import AdminSidebar from "./AdminSidebar";
import AdminGlobalTopBar from "./AdminGlobalTopBar";
import { AdminSearchProvider } from "./AdminSearchContext";

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

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [newGranteesToday, approvedMemberCountToday] = await Promise.all([
    prisma.grantee.count({ where: { createdAt: { gte: startOfToday } } }),
    getProfilingRegistrationCountByStatusSince("Approved", startOfToday),
  ]);

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
        AND: [skeapStatusWhere(["pending", "return", "resubm", "respond"])],
        createdAt: { gte: startOfToday },
      },
    }),
    prisma.submission.count({ where: { status: "PENDING", submittedAt: { gte: startOfToday } } }),
    prisma.profilingRegistration.count({ where: { submittedAt: { gte: startOfToday } } }),
  ]);
  return (
    <AdminSearchProvider>
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
          <main className="h-full min-w-0 flex-1 overflow-y-auto">
            <AdminGlobalTopBar />
            <div className="px-8 py-8">{children}</div>
          </main>
        </div>
      </div>
    </AdminSearchProvider>
  );
}
