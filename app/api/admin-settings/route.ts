import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const DEFAULT_SETTINGS = {
  inquiryAlerts: true,
  submissionAlerts: true,
};

type AppUserWithSettings = {
  id: string;
  authId: string;
  email: string;
  fullName: string;
  role: Role;
  settings: { inquiryAlerts: boolean; submissionAlerts: boolean } | null;
};

async function getAppUser(authId: string | null): Promise<AppUserWithSettings | null> {
  if (!authId) return null;
  return prisma.user.findUnique({ where: { authId } }) as Promise<AppUserWithSettings | null>;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUser = await getAppUser(user.id);
  if (!appUser || (appUser.role !== Role.SK_OFFICIAL && appUser.role !== Role.SUPER_ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    fullName: appUser.fullName ?? "",
    email: appUser.email,
    settings: appUser.settings ?? DEFAULT_SETTINGS,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUser = await getAppUser(user.id);
  if (!appUser || (appUser.role !== Role.SK_OFFICIAL && appUser.role !== Role.SUPER_ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await request.json();
  const { fullName, email, newPassword, confirmPassword, inquiryAlerts, submissionAlerts } = payload;

  if (!fullName || !email) {
    return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  }

  if (newPassword && newPassword !== confirmPassword) {
    return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
  }

  const authUpdatePayload: { email?: string; password?: string } = {};
  if (email !== appUser.email) {
    authUpdatePayload.email = email;
  }
  if (newPassword) {
    authUpdatePayload.password = newPassword;
  }

  if (Object.keys(authUpdatePayload).length > 0) {
    const { error: authError } = await supabase.auth.updateUser(authUpdatePayload);
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }
  }

  try {
    await prisma.user.update({
      where: { authId: user.id },
      data: {
        fullName,
        email,
        settings: {
          inquiryAlerts: Boolean(inquiryAlerts),
          submissionAlerts: Boolean(submissionAlerts),
        },
      } as unknown as Prisma.UserUpdateInput,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update settings." }, { status: 500 });
  }
}
