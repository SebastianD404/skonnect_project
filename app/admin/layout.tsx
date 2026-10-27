import { Role } from "@prisma/client";
import { cookies } from "next/headers";
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
  const adminUser = await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);

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
  const cookieStore = await cookies();
  const profilingLastViewedCookie = cookieStore.get("admin-kk-profiling-last-viewed")?.value;
  const profilingLastViewed = profilingLastViewedCookie ? new Date(profilingLastViewedCookie) : null;
  const validProfilingLastViewed =
    profilingLastViewed && !Number.isNaN(profilingLastViewed.getTime()) ? profilingLastViewed : null;
  const getCookieViewedAt = (name: string) => {
    const value = cookieStore.get(name)?.value;
    if (!value) return startOfToday;
    const viewedAt = new Date(value);
    return Number.isNaN(viewedAt.getTime()) ? startOfToday : viewedAt;
  };
  const inquiryLastViewed = getCookieViewedAt("admin-inquiries-last-viewed");
  const skeapLastViewed = getCookieViewedAt("admin-skeap-applications-last-viewed");
  const submissionsLastViewed = getCookieViewedAt("admin-submissions-last-viewed");
  const granteesLastViewed = getCookieViewedAt("admin-grantees-last-viewed");
  const membersLastViewed = getCookieViewedAt("admin-members-last-viewed");

  const [newGranteesToday, approvedMemberCountToday] = await Promise.all([
    prisma.grantee.count({ where: { createdAt: { gte: granteesLastViewed } } }),
    getProfilingRegistrationCountByStatusSince("Approved", membersLastViewed),
  ]);

  const [
    openInquiryCountToday,
    skeapApplicationCountToday,
    pendingDocumentCountToday,
    profilingRegistrationCountToday,
  ] = await Promise.all([
    prisma.inquiry.count({ where: { ...supportInquiryFilter, isResolved: false, createdAt: { gte: inquiryLastViewed } } }),
    prisma.inquiry.count({
      where: {
        ...subjectWhere,
        NOT: [excludeCancelled, excludeApproved],
        AND: [skeapStatusWhere(["pending", "return", "resubm", "respond"])],
        createdAt: { gte: skeapLastViewed },
      },
    }),
    prisma.submission.count({ where: { status: "PENDING", submittedAt: { gte: submissionsLastViewed } } }),
    prisma.profilingRegistration.count({
      where: {
        submittedAt: validProfilingLastViewed
          ? { gt: validProfilingLastViewed }
          : { gte: startOfToday },
      },
    }),
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
            userRole={adminUser.role}
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
