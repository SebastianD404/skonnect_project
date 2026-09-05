"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureProfile } from "@/lib/auth";
import {
  GRANTEE_PLACEHOLDER_SCHOOL,
  GRANTEE_PLACEHOLDER_YEAR_LEVEL,
} from "@/lib/grantee-profile";

const db = prisma;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeEmail(value: string) {
  return value.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "").trim().toLowerCase();
}

export type ProfileState = {
  error?: string;
  message?: string;
} | null;

export async function updateProfileName(
  _prevState: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const phoneNumber = String(formData.get("phoneNumber") ?? "").trim();
  const school = String(formData.get("school") ?? "").trim();
  const yearLevel = String(formData.get("yearLevel") ?? "").trim();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!fullName || !email || !phoneNumber) {
    return { error: "Your name, email, and phone number are required." };
  }

  if (!isValidEmail(email)) {
    return { error: "Please enter a valid email address." };
  }

  if (newPassword || confirmPassword || currentPassword) {
    if (!currentPassword || !newPassword || !confirmPassword) {
      return { error: "Enter your current password and both new password fields." };
    }
    if (!strongPassword(newPassword)) {
      return { error: "New password must be at least 8 characters with uppercase, lowercase, and number." };
    }
    if (newPassword !== confirmPassword) {
      return { error: "New passwords do not match." };
    }
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

  const sessionEmail = normalizeEmail(user.email ?? profile.email);

  if (sessionEmail !== email) {
    const emailOwner = await db.user.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        NOT: { id: profile.id },
      },
      select: { id: true },
    });

    if (emailOwner) {
      return { error: "That email address is already linked to another account." };
    }
  }

  if (newPassword) {
    const { error: verifyPasswordError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: currentPassword,
    });

    if (verifyPasswordError) {
      return { error: "Your current password is incorrect." };
    }
  }

  if (sessionEmail !== email) {
    const adminSupabase = createAdminClient();
    const { error: authUpdateError } = await adminSupabase.auth.admin.updateUserById(user.id, {
      email,
      email_confirm: true,
    });

    if (authUpdateError) {
      if (authUpdateError.message.toLowerCase().includes("already") || authUpdateError.message.toLowerCase().includes("exists")) {
        return { error: "This email is already in use." };
      }
      return { error: "We could not update your login email. Please check the address and try again." };
    }
  }

  if (newPassword) {
    const { error: passwordUpdateError } = await supabase.auth.updateUser({ password: newPassword });
    if (passwordUpdateError) {
      return { error: `We could not update your password: ${passwordUpdateError.message}` };
    }
  }

  if (profile.role === "GRANTEE" && (!school || !yearLevel)) {
    return { error: "School and year level are required for grantee profiles." };
  }

  try {
    await db.user.update({
      where: { id: profile.id },
      data: {
        fullName,
        email,
        phoneNumber,
      },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      return { error: "That email address is already linked to another account." };
    }
    return { error: "We could not update your profile. Please try again." };
  }

  if (profile.role === "GRANTEE") {
    try {
      await db.grantee.upsert({
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
    } catch {
      return { error: "Your profile email was updated, but school details could not be saved." };
    }
  }

  // Cookie refresh is best-effort: the profile and credentials are already saved.
  // The next request will re-authenticate from the updated Supabase user record.
  if (sessionEmail !== email || newPassword) {
    try {
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.warn("Profile saved, but session refresh returned an error:", refreshError.message);
      }
    } catch (error) {
      console.warn("Profile saved, but session refresh was unavailable:", error);
    }
  }

  return {
    message: newPassword
      ? "Your profile and password have been successfully updated."
      : "Your profile was updated.",
  };
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