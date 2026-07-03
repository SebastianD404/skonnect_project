"use server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ensureProfile, getRoleHomePath } from "@/lib/auth";

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

  const next = (formData.get("next") as string) || "";
  const nextQuery = next ? `&next=${encodeURIComponent(next)}` : "";
  redirect(`/login?notice=confirm_email${nextQuery}`);
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

  if (!authUser) {
    return { error: "Login succeeded, but no authenticated user was returned." };
  }

  const profile = await ensureProfile(authUser);
  if (!profile) {
    return {
      error:
        "Your account is authenticated, but profile setup failed. Please contact support.",
    };
  }

  const next = (formData.get("next") as string) || "";
  if (profile.mustSecureAccount) {
    const secureRedirect = next && next.startsWith("/")
      ? `/secure-account?redirect=${encodeURIComponent(next)}`
      : "/secure-account";
    return redirect(secureRedirect);
  }

  // If the login form included a `next` param, prefer redirecting there.
  if (next && next.startsWith("/")) {
    return redirect(next);
  }

  const destination = getRoleHomePath(profile.role);
  if (destination) {
    return redirect(destination);
  }

  return redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return redirect("/login");
}