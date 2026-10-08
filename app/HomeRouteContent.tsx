import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getRoleHomePath } from "@/lib/auth";
import HomePageContent from "./HomePageContent";

export default async function HomeRouteContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const appUser = await prisma.user.findFirst({
      where: {
        OR: [
          { authId: user.id },
          ...(user.email ? [{ email: user.email }] : []),
        ],
      },
      select: { role: true },
    });
    const destination = getRoleHomePath(appUser?.role);

    if (destination && destination !== "/") {
      redirect(destination);
    }
  }

  return <HomePageContent />;
}
