import { GranteeStatus, Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { refreshSystemUsersAdminView } from "@/lib/application-admin-view-refresh";
import { createClient } from "@/lib/supabase/server";
import YouthDashboardHeader from "./YouthDashboardHeader";
import YouthOnboardingCallout from "./YouthOnboardingCallout";

const INACTIVE_GRANTEE_STATUSES = new Set<string>([
  GranteeStatus.GRADUATED,
  GranteeStatus.REMOVED,
  GranteeStatus.REVOKED,
]);

export default async function YouthDashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login?next=%2Fyouth%2Fdashboard");
  }

  const user = await prisma.user.findUnique({
    where: { authId: authUser.id },
    select: {
      id: true,
      role: true,
      isActive: true,
      kkProfile: { select: { id: true } },
      grantee: { select: { status: true } },
    },
  });

  if (!user || !user.isActive) {
    redirect("/login");
  }

  const isInactiveGrantee = INACTIVE_GRANTEE_STATUSES.has(user.grantee?.status ?? "");
  if (user.role === Role.GRANTEE && isInactiveGrantee) {
    const roleUpdate = await prisma.user.updateMany({
      where: { id: user.id, role: Role.GRANTEE },
      data: { role: Role.YOUTH },
    });
    if (roleUpdate.count > 0) await refreshSystemUsersAdminView();
  } else if (user.role !== Role.YOUTH) {
    redirect(user.role === Role.GRANTEE ? "/grantee-dashboard" : "/");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFBFC] via-[#F5F7FB] to-[#F0F4FA] text-[#1A1A1A]">
      <YouthDashboardHeader />
      {user.role === Role.YOUTH && !user.kkProfile ? <YouthOnboardingCallout /> : null}
      {children}
    </div>
  );
}
