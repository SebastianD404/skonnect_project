import { Prisma, Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

type SupabaseUser = {
  id?: string;
  email?: string | null;
  user_metadata?: unknown;
};

function resolveFullName(authUser: SupabaseUser) {
  const metadata = (authUser.user_metadata as Record<string, unknown> | undefined) ?? {};
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

export async function ensureProfile(authUser: SupabaseUser) {
  const authId = authUser?.id;
  const email = String(authUser?.email || "").trim();

  if (!authId || !email) {
    return null;
  }

  const selectFields = {
    id: true,
    fullName: true,
    email: true,
    role: true,
    avatarUrl: true,
    username: true,
    mustSecureAccount: true,
    usesTemporaryPassword: true,
    phoneNumber: true,
    kkProfileId: true,
  };

  try {
    const existingByAuthId = await prisma.user.findUnique({
      where: { authId },
      select: selectFields,
    });
    if (existingByAuthId) {
      return existingByAuthId;
    }

    const existingByEmail = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: selectFields,
    });

    if (existingByEmail) {
      try {
        return await prisma.user.update({
          where: { id: existingByEmail.id },
          data: { authId },
          select: selectFields,
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          // Fall through to lookup below when authId/email conflicts happen.
        } else {
          throw error;
        }
      }
    }

    try {
      return await prisma.user.create({
        data: {
          authId,
          email,
          fullName: resolveFullName(authUser),
          role: "YOUTH",
        },
        select: selectFields,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        // Fall through to fallback lookups below.
      } else {
        throw error;
      }
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const fallbackProfile = await prisma.user.findUnique({
        where: { authId },
        select: selectFields,
      });
      if (fallbackProfile) {
        return fallbackProfile;
      }

      const fallbackByEmail = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: selectFields,
      });
      if (fallbackByEmail) {
        return fallbackByEmail;
      }
    }

    throw error;
  }
  // Ensure function always returns null when no profile could be resolved
  return null;
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

  if (appUser.mustSecureAccount) {
    redirect("/secure-account");
  }

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
    } catch {
      // ignore sign-out errors
    }
    redirect("/login?reason=access_denied");
  }

  return appUser;
}