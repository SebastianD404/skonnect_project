import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function computeAge(birthDate: Date) {
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const appUser = await ensureProfile(user);
  if (!appUser) {
    return NextResponse.json({ error: "User profile not found" }, { status: 404 });
  }

  const profile = await prisma.user.findUnique({
    where: { id: appUser.id },
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      kkProfile: {
        select: {
          id: true,
          fullName: true,
          purok: true,
          addressLine: true,
          barangay: true,
          birthDate: true,
          contactNumber: true,
          email: true,
        },
      },
    },
  });

  if (!profile?.kkProfile) {
    return NextResponse.json({ error: "KK profile not found" }, { status: 404 });
  }

  return NextResponse.json({
    profile: {
      id: profile.kkProfile.id,
      fullName: profile.kkProfile.fullName,
      email: profile.kkProfile.email || profile.email,
      contactNumber: profile.kkProfile.contactNumber || profile.phoneNumber,
      purok: profile.kkProfile.purok,
      addressLine: profile.kkProfile.addressLine,
      barangay: profile.kkProfile.barangay,
      birthDate: profile.kkProfile.birthDate,
      age: computeAge(profile.kkProfile.birthDate),
    },
  });
}
