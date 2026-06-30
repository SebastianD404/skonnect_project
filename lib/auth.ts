import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

function resolveFullName(authUser: any) {
  const metadata = authUser.user_metadata || {};
  const fullNameFromMetadata =
    (typeof metadata.full_name === "string" && metadata.full_name.trim()) ||
    (typeof metadata.name === "string" && metadata.name.trim()) ||
    "";

  if (fullNameFromMetadata) {
    return fullNameFromMetadata.replace(/\s+/g, " ").trim();
  }

  const local = String(authUser.email || "").split("@")[0] || "";
  const cleaned = local
    .replace(/[._-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\d+/g, " ")
    .trim();

  if (!cleaned) return "SK Youth";

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase() + parts[0].slice(1);
  return `${parts[0][0].toUpperCase() + parts[0].slice(1)} ${parts[parts.length - 1][0].toUpperCase() + parts[parts.length - 1].slice(1)}`;
}

export async function ensureProfile(authUser: any) {
  const authId = authUser?.id;
  const email = String(authUser?.email || "").trim();

  if (!authId || !email) {
    return null;
  }

  let profile = await prisma.user.findUnique({
    where: { authId },
    select: { fullName: true, email: true, role: true, avatarUrl: true },
  });

  if (!profile) {
    const existingByEmail = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, role: true, fullName: true, email: true, avatarUrl: true },
    });

    if (existingByEmail) {
      profile = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: { authId },
        select: { fullName: true, email: true, role: true, avatarUrl: true },
      });
    } else {
      profile = await prisma.user.create({
        data: {
          authId,
          email,
          fullName: resolveFullName(authUser),
          role: "YOUTH",
        },
        select: { fullName: true, email: true, role: true, avatarUrl: true },
      });
    }
  }

  return profile;
}

export function getRoleHomePath(role?: Role | null) {
  switch (role) {
    case "GRANTEE":
      return "/grantee-dashboard";
    case "SK_OFFICIAL":
      return "/admin";
    case "SUPER_ADMIN":
      return "/system-admin";
    default:
      return null;
  }
}

export async function redirectIfSignedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const appUser = await ensureProfile(user);
  if (!appUser) return;

  const destination = getRoleHomePath(appUser.role);
  if (destination) {
    redirect(destination);
  }
}

export async function requireRole(allowedRoles: readonly Role[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const appUser = await ensureProfile(user);
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