import { Suspense } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getRoleHomePath } from "@/lib/auth";
import { getPastGranteeReapplicationState } from "@/lib/past-grantee-reapplication";
import HomePageContent from "./HomePageContent";
import HomeSkeleton from "./HomeSkeleton";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const appUser = user
    ? await prisma.user.findFirst({
      where: { authId: user.id, isActive: true },
      select: { id: true, role: true },
    })
    : null;
  const initialHeroState = await getPastGranteeReapplicationState(appUser?.id ?? null);
  const destination = getRoleHomePath(appUser?.role);

  if (destination && !initialHeroState.isPastGrantee) {
    redirect(destination);
  }

  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomePageContent initialHeroState={initialHeroState} />
    </Suspense>
  );
}
