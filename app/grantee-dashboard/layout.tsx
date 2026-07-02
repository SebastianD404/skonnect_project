import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import GranteeDashboardHeader from "./GranteeDashboardHeader";
import GranteeWelcomeGate from "./GranteeWelcomeGate";

export default async function GranteeDashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const appUser = await prisma.user.findFirst({
    where: {
      OR: [{ authId: user.id }, { email: user.email ?? "" }],
    },
    select: { id: true, authId: true, role: true, hasSeenOnboarding: true },
  });

  // Repair stale auth links when the email matches an existing account.
  if (appUser && appUser.authId !== user.id) {
    try {
      await prisma.user.update({
        where: { id: appUser.id },
        data: { authId: user.id },
      });
    } catch {
      // Ignore link update failures and continue with current session data.
    }
  }

  if (!appUser || appUser.role !== "GRANTEE") {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFBFC] via-[#F5F7FB] to-[#F0F4FA] text-[#1A1A1A]">
      <GranteeWelcomeGate initialShouldShow={!appUser.hasSeenOnboarding} />
      <GranteeDashboardHeader />
      {children}
    </div>
  );
}
