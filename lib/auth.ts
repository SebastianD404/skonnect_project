import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function requireRole(allowedRoles: readonly Role[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const appUser = await prisma.user.findUnique({
    where: { authId: user.id },
    select: { role: true },
  });

  if (!appUser) {
    redirect("/login");
  }

  if (!allowedRoles.includes(appUser.role)) {
    // Sign out the current session to avoid carrying a mismatched role across
    // routes in the same browser session, then redirect to login.
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // ignore sign-out errors
    }
    redirect("/login?reason=access_denied");
  }

  return appUser;
}