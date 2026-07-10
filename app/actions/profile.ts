"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import {
  GRANTEE_PLACEHOLDER_SCHOOL,
  GRANTEE_PLACEHOLDER_YEAR_LEVEL,
} from "@/lib/grantee-profile";

export type ProfileState = {
  error?: string;
  message?: string;
} | null;

export async function updateProfileName(
  _prevState: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phoneNumber = String(formData.get("phoneNumber") ?? "").trim();
  const school = String(formData.get("school") ?? "").trim();
  const yearLevel = String(formData.get("yearLevel") ?? "").trim();

  if (!fullName || !email || !phoneNumber) {
    return { error: "Your name, email, and phone number are required." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to update your profile." };
  }

  const profile = await ensureProfile(user);

  if (!profile) {
    return { error: "We could not find your SKonnect profile." };
  }

  if (profile.email !== email) {
    const { error: authUpdateError } = await supabase.auth.updateUser({
      email,
    });

    if (authUpdateError) {
      return { error: authUpdateError.message };
    }
  }

  if (profile.role === "GRANTEE" && (!school || !yearLevel)) {
    return { error: "School and year level are required for grantee profiles." };
  }

  await prisma.user.update({
    where: { id: profile.id },
    data: {
      fullName,
      email,
      phoneNumber,
    },
  });

  if (profile.role === "GRANTEE") {
    await prisma.grantee.upsert({
      where: { userId: profile.id },
      create: {
        userId: profile.id,
        school: school || GRANTEE_PLACEHOLDER_SCHOOL,
        yearLevel: yearLevel || GRANTEE_PLACEHOLDER_YEAR_LEVEL,
        status: "ACTIVE",
      },
      update: {
        school,
        yearLevel,
      },
    });
  }

  return { message: "Your profile was updated." };
}

function strongPassword(value: string) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(value);
}

export async function changePassword(
  _prevState: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "All password fields are required." };
  }

  if (!strongPassword(newPassword)) {
    return { error: "New password must be at least 8 characters with uppercase, lowercase, and number." };
  }

  if (newPassword !== confirmPassword) {
    return { error: "New passwords do not match." };
  }

  if (currentPassword === newPassword) {
    return { error: "Your new password must be different from your current password." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to change your password." };
  }

  const profile = await ensureProfile(user);

  if (!profile) {
    return { error: "We could not find your SKonnect profile." };
  }

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: currentPassword,
  });

  if (verifyError) {
    return { error: "Current password is incorrect." };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    return { error: updateError.message };
  }

  const { error: refreshError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: newPassword,
  });

  if (refreshError) {
    return { error: `Password updated, but the session refresh failed: ${refreshError.message}` };
  }

  return { message: "Your password was updated." };
}