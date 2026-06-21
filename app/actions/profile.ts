"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

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
    select: { id: true },
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

  await prisma.user.update({
    where: { id: profile.id },
    data: {
      fullName,
      email,
      phoneNumber,
    },
  });

  return { message: "Your profile was updated." };
}