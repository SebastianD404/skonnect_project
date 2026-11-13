import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

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

  redirect("/programs/kk-profiling");
}
