import { Suspense } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getRoleHomePath } from "@/lib/auth";
import HomePageContent from "./HomePageContent";
import HomeSkeleton from "./HomeSkeleton";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const appUser = await prisma.user.findFirst({
      where: { authId: user.id, isActive: true },
      select: { role: true },
    });
    const destination = getRoleHomePath(appUser?.role);

    if (destination) {
      redirect(destination);
    }
  }

  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomePageContent />
    </Suspense>
  );
}
