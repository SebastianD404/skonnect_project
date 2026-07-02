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