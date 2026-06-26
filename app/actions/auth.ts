"use server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export type AuthState = {
  error?: string;
} | null;

export async function signup(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("fullName") as string;

  if (!email || !password || !fullName) {
    return { error: "All fields are required." };
  }

  const supabase = await createClient();

  // 1. Create the Supabase Auth identity
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) {
    return { error: authError.message };
  }

  if (!authData.user) {
    return { error: "Signup failed - no user returned." };
  }

  // 2. Create the matching row in our Postgres `users` table via Prisma.
  // New signups always start as YOUTH. Role upgrades to GRANTEE, SK_OFFICIAL,
  // or SUPER_ADMIN happen later through an admin action, never at signup time.
  try {
    await prisma.user.create({
      data: {
        authId: authData.user.id,
        email,
        fullName,
        role: "YOUTH",
      },
    });
  } catch (dbError) {
    console.error("Failed to create User row:", dbError);
    return { error: "Account created but profile setup failed. Please contact support." };
  }

  redirect("/login?notice=confirm_email");
}

export async function login(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  const authUser = data.user;
  const authUserId = authUser?.id;

  if (!authUserId) {
    return { error: "Login succeeded, but no authenticated user was returned." };
  }

  // Look up the user's role to decide where to send them.
  // If the Supabase auth identity exists but the app profile row is missing,
  // recover by linking or creating the missing user profile.
  let dbUser = await prisma.user.findUnique({
    where: { authId: authUserId },
    select: { role: true },
  });

  if (!dbUser) {
    const email = authUser?.email;

    if (!email) {
      return {
        error:
          "Your account is authenticated, but we could not identify your email address to create a profile. Please contact support.",
      };
    }

    const existingByEmail = await prisma.user.findUnique({
      where: { email },
      select: { authId: true, role: true },
    });

    if (existingByEmail) {
      if (existingByEmail.authId !== authUserId) {
        await prisma.user.update({
          where: { email },
          data: { authId: authUserId },
        });
      }

      dbUser = {
        role: existingByEmail.role,
      };
    } else {
      const metadata = authUser.user_metadata as Record<string, unknown> | undefined;
      const fullName =
        (typeof metadata?.full_name === "string" && metadata.full_name) ||
        email ||
        "SK Youth";

      try {
        dbUser = await prisma.user.create({
          data: {
            authId: authUserId,
            email,
            fullName,
            role: "YOUTH",
          },
          select: { role: true },
        });
      } catch (dbError) {
        console.error("Failed to create fallback User row:", dbError);

        return {
          error:
            "Your account is authenticated, but profile setup failed. Please contact support.",
        };
      }
    }
  }

  switch (dbUser.role) {
    case "SUPER_ADMIN":
      redirect("/system-admin");
    case "SK_OFFICIAL":
      redirect("/admin");
    case "GRANTEE":
      redirect("/grantee-dashboard");
    default:
      redirect("/");
  }
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}