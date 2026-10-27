"use server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { ensureProfile, getRoleHomePath } from "@/lib/auth";

export type AuthState = {
  error?: string;
} | null;

export type PasswordRecoveryState = {
  error?: string;
  message?: string;
  redirectTo?: string;
} | null;

function isStrongPassword(value: string) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(value);
}

export async function requestPasswordReset(
  _prevState: PasswordRecoveryState,
  formData: FormData
): Promise<PasswordRecoveryState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email) {
    return { error: "Enter the email address for your account." };
  }

  const requestHeaders = await headers();
  const origin =
    requestHeaders.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
  });

  if (error) {
    console.error("Password recovery email request failed", {
      code: error.code,
      status: error.status,
    });
    return { error: "We couldn't send a recovery email right now. Please try again later." };
  }

  return {
    message: "If an account exists for that email, a password recovery link has been sent.",
  };
}

export async function resetPassword(
  _prevState: PasswordRecoveryState,
  formData: FormData
): Promise<PasswordRecoveryState> {
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!isStrongPassword(password)) {
    return { error: "Use at least 8 characters with uppercase, lowercase, and a number." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "This recovery link is invalid or expired. Request a new one and try again." };
  }

  const appUser = await ensureProfile(user);
  if (!appUser) {
    return { error: "Your account profile could not be loaded. Please contact support." };
  }

  const { error } = await supabase.auth.updateUser({
    password,
    data: {
      must_secure_account: false,
      temporary_credential: false,
    },
  });
  if (error) {
    console.error("Password recovery update rejected", {
      code: error.code,
      status: error.status,
      message: error.message,
    });

    const errorCode = error.code?.toLowerCase() || "";
    const errorMessage = error.message.toLowerCase();
    if (
      errorCode.includes("weak_password") ||
      errorMessage.includes("weak password") ||
      errorMessage.includes("password should")
    ) {
      return {
        error: "Choose a password different from your current one.",
      };
    }
    if (
      errorCode.includes("same_password") ||
      errorMessage.includes("different from the old password")
    ) {
      return { error: "Choose a password you haven't used for this account before." };
    }
    if (error.status === 401 || error.status === 403) {
      return {
        error: "Your recovery link has expired. Request a new link and try again.",
      };
    }

    return {
      error: error.message
        ? `We couldn't update your password: ${error.message}`
        : "We couldn't update your password. Try a different password or request a new recovery link.",
    };
  }

  await prisma.user.update({
    where: { id: appUser.id },
    data: {
      mustSecureAccount: false,
      usesTemporaryPassword: false,
    },
  });

  return {
    redirectTo: appUser.kkProfileId
      ? "/programs/kk-profiling/status"
      : getRoleHomePath(appUser.role) || "/",
  };
}

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