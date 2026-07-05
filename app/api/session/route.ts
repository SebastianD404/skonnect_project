import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ user: null });
  }

  const profile = await ensureProfile(user);

  if (!profile) {
    return NextResponse.json({ user: null });
  }

  // Fetch the latest SKEAP application for this user (if any) so the client
  // can autofill additional profile fields like address, age, gender, contact.
  let skeapApplication = null;
  try {
    skeapApplication = await prisma.skeapApplication.findFirst({
      where: { userId: profile.id },
      orderBy: { submittedAt: "desc" },
      select: {
        applicantName: true,
        permanentAddress: true,
        age: true,
        gender: true,
        contactNumber: true,
        emailAddress: true,
      },
    });
  } catch (e) {
    // Non-fatal - return profile without SKEAP data on error
    skeapApplication = null;
  }

  // Fetch KK profiling data if the user has a linked KK profile
  let kkProfile = null;
  try {
    if (profile.kkProfileId) {
      kkProfile = await prisma.kKProfile.findUnique({
        where: { id: profile.kkProfileId },
        select: {
          fullName: true,
          addressLine: true,
          contactNumber: true,
          birthDate: true,
          email: true,
        },
      });
    }
  } catch (e) {
    kkProfile = null;
  }

  const metadataAvatar = (user.user_metadata as any)?.avatar_url || (user.user_metadata as any)?.avatarUrl || null;
  const avatarPath = profile.avatarUrl || metadataAvatar;

  const profileWithApp = { ...profile, skeapApplication, kkProfile };

  if (avatarPath) {
    if (!avatarPath.startsWith("http://") && !avatarPath.startsWith("https://")) {
      try {
        const signed = await supabase.storage.from("avatars").createSignedUrl(avatarPath, 60 * 60 * 24 * 7);
        const signedUrl = signed.data?.signedUrl;
        return NextResponse.json({ user: { ...profileWithApp, avatarUrl: signedUrl || avatarPath } });
      } catch (e) {
        return NextResponse.json({ user: { ...profileWithApp, avatarUrl: avatarPath } });
      }
    }

    return NextResponse.json({ user: { ...profileWithApp, avatarUrl: avatarPath } });
  }

  return NextResponse.json({ user: profileWithApp });
}
