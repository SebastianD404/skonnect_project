"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
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
  const phoneNumberRaw = String(formData.get("phoneNumber") ?? "").trim();
  const phoneNumber = phoneNumberRaw.length > 0 ? phoneNumberRaw : null;
  const school = String(formData.get("school") ?? "").trim();
  const yearLevel = String(formData.get("yearLevel") ?? "").trim();

  if (!fullName || !email) {
    return { error: "Your name and email are required." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to update your profile." };
  }

  const profile = await prisma.user.findUnique({
    where: { authId: user.id },
    select: { id: true, role: true },
  });

  if (!profile) {
    return { error: "We could not find your SKonnect profile." };
  }

  const currentProfile = await prisma.user.findUnique({
    where: { id: profile.id },
    select: {
      email: true,
    },
  });

  if (!currentProfile) {
    return { error: "We could not load your current profile details." };
  }

  if (currentProfile.email !== email) {
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