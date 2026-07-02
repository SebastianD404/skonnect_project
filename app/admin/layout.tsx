import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma, getProfilingRegistrationCount } from "@/lib/prisma";
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

  const skeapReviewBaseWhere = {
    subject: { contains: "SKEAP application", mode: "insensitive" as const },
    NOT: [
      { reviewStatus: { contains: "cancel", mode: "insensitive" as const } },
      { reviewStatus: { contains: "approve", mode: "insensitive" as const } },
      { response: { contains: "cancel", mode: "insensitive" as const } },
      { response: { contains: "approve", mode: "insensitive" as const } },
    ],
  };

  const [upcomingEventCount, openInquiryCount, pendingSkeapReviewCount, resubmittedSkeapReviewCount, pendingDocumentCount, profilingRegistrationCount] = await Promise.all([
    prisma.event.count({
      where: {
        status: {
          in: ["UPCOMING", "REGISTRATION_OPEN"],
        },
      },
    }),
    prisma.inquiry.count({
      where: { ...supportInquiryFilter, isResolved: false },
    }),
    prisma.inquiry.count({
      where: {
        ...skeapReviewBaseWhere,
        OR: [
          { reviewStatus: { contains: "pending", mode: "insensitive" as const } },
          { response: { contains: "pending", mode: "insensitive" as const } },
        ],
      },
    }),
    prisma.inquiry.count({
      where: {
        ...skeapReviewBaseWhere,
        OR: [
          { reviewStatus: { contains: "resubm", mode: "insensitive" as const } },
          { response: { contains: "resubm", mode: "insensitive" as const } },
        ],
      },
    }),
    prisma.submission.count({ where: { status: "PENDING" } }),
    getProfilingRegistrationCount(),
  ]);

  const skeapApplicationCount = pendingSkeapReviewCount + resubmittedSkeapReviewCount;
  return (
    <div className="h-screen w-screen overflow-hidden bg-[#F8FBFF] text-slate-950">
      <div className="mx-auto flex h-full max-w-[1480px]">
        <AdminSidebar
          upcomingEventCount={upcomingEventCount}
          openInquiryCount={openInquiryCount}
          skeapApplicationCount={skeapApplicationCount}
          pendingDocumentCount={pendingDocumentCount}
          profilingRegistrationCount={profilingRegistrationCount}
        />
        <main className="flex-1 h-full overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
