import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import YouthDashboardHeader from "@/app/youth-dashboard/YouthDashboardHeader";
import YouthOnboardingGate from "@/app/youth-dashboard/YouthOnboardingGate";

export default async function YouthOnboardingRouteGuard({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return children;

  const user = await prisma.user.findUnique({
    where: { authId: authUser.id },
    select: { role: true, isActive: true, kkStatus: true },
  });

  if (!user?.isActive || user.role !== Role.YOUTH || user.kkStatus !== "UNPROFILED") {
    return children;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFBFC] via-[#F5F7FB] to-[#F0F4FA] text-[#1A1A1A]">
      <YouthDashboardHeader onboarding />
      <YouthOnboardingGate />
    </div>
  );
}
