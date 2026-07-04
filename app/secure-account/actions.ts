"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureProfile, getRoleHomePath } from "@/lib/auth";

type SecureState = { error?: string; success?: string } | null;

function strongPassword(value: string) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(value);
}

export async function secureAccount(
  _prevState: SecureState,
  formData: FormData
): Promise<SecureState> {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");
  const redirectParam = String(formData.get("redirect") || "").trim() || null;

  if (!username || username.length < 4) {
    return { error: "Username must be at least 4 characters." };
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    return { error: "Username may only include letters, numbers, dot, underscore, and dash." };
  }
  if (username.includes("@")) {
    return { error: "Username cannot be an email address. Use only letters, numbers, dot, underscore, and dash." };
  }
  if (!strongPassword(password)) {
    return { error: "Password must be at least 8 characters with uppercase, lowercase, and number." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Session expired. Please log in again." };
  }

  const appUser = await ensureProfile(user);
  if (!appUser) {
    return { error: "User profile not found." };
  }

  if (!appUser.mustSecureAccount) {
    const destination = redirectParam || getRoleHomePath(appUser.role) || "/";
    redirect(destination);
  }

  const existing = await prisma.user.findFirst({
    where: {
      username: { equals: username, mode: "insensitive" },
      NOT: { id: appUser.id },
    },
    select: { id: true },
  });

  if (existing) {
    return { error: "Username is already taken." };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password,
    data: {
      must_secure_account: false,
      temporary_credential: false,
    },
  });

  if (updateError) {
    return { error: updateError.message };
  }

  // Reauthenticate immediately after password reset to keep the session alive.
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: appUser.email,
    password,
  });

  if (signInError) {
    return { error: `Secure account succeeded, but sign-in failed: ${signInError.message}` };
  }

  await prisma.user.update({
    where: { id: appUser.id },
    data: {
      username,
      mustSecureAccount: false,
      usesTemporaryPassword: false,
    },
  });

  const destination = redirectParam || getRoleHomePath(appUser.role) || "/";
  redirect(destination);
}
