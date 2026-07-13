import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Prisma, Role, ReminderType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureProfile } from "@/lib/auth";
import { parseReminderOffsets } from "@/lib/reminders";

const DEFAULT_SETTINGS = {
  inquiryAlerts: true,
  submissionAlerts: true,
  skeapReminderOffsets: "7, 3, 1",
  eventReminderOffsets: "7, 3, 1",
  skeapDeadline: null,
};

type AppUserWithSettings = {
  id: string;
  authId: string;
  email: string;
  fullName: string;
  role: Role;
  settings: { inquiryAlerts: boolean; submissionAlerts: boolean } | null;
};

async function getAppUser(authUser: any): Promise<AppUserWithSettings | null> {
  const linkedUser = await ensureProfile(authUser);
  if (!linkedUser) return null;
  return prisma.user.findUnique({ where: { id: linkedUser.id } }) as Promise<AppUserWithSettings | null>;
}

async function getReminderSettings() {
  const skeap = await prisma.reminderSetting.findUnique({
    where: { type: ReminderType.SKEAP_APPLICATION },
  });

  const event = await prisma.reminderSetting.findUnique({
    where: { type: ReminderType.EVENT_REGISTRATION },
  });

  return {
    skeapReminderOffsets:
      skeap?.offsets.length > 0 ? skeap.offsets.join(", ") : DEFAULT_SETTINGS.skeapReminderOffsets,
    eventReminderOffsets:
      event?.offsets.length > 0 ? event.offsets.join(", ") : DEFAULT_SETTINGS.eventReminderOffsets,
    skeapDeadline: skeap?.deadline ? skeap.deadline.toISOString().slice(0, 10) : null,
  };
}

async function upsertReminderSetting(type: ReminderType, offsets: number[], deadline?: string | null) {
  return prisma.reminderSetting.upsert({
    where: { type },
    create: {
      type,
      offsets,
      deadline: deadline ? new Date(`${deadline}T00:00:00.000Z`) : null,
    },
    update: {
      offsets,
      deadline: deadline ? new Date(`${deadline}T00:00:00.000Z`) : null,
    },
  });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUser = await getAppUser(user);
  if (!appUser || (appUser.role !== Role.SK_OFFICIAL && appUser.role !== Role.SUPER_ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const reminderSettings = await getReminderSettings();

  return NextResponse.json({
    fullName: appUser.fullName ?? "",
    email: appUser.email,
    settings: appUser.settings ?? DEFAULT_SETTINGS,
    reminderSettings,
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

  const appUser = await getAppUser(user);
  if (!appUser || (appUser.role !== Role.SK_OFFICIAL && appUser.role !== Role.SUPER_ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await request.json();
  const {
    fullName,
    email,
    newPassword,
    confirmPassword,
    inquiryAlerts,
    submissionAlerts,
    skeapReminderOffsets,
    eventReminderOffsets,
    skeapDeadline,
  } = payload;

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
      where: { id: appUser.id },
      data: {
        fullName,
        email,
        settings: {
          inquiryAlerts: Boolean(inquiryAlerts),
          submissionAlerts: Boolean(submissionAlerts),
        },
      } as unknown as Prisma.UserUpdateInput,
    });

    await upsertReminderSetting(
      ReminderType.SKEAP_APPLICATION,
      parseReminderOffsets(String(skeapReminderOffsets ?? "")),
      typeof skeapDeadline === "string" ? skeapDeadline : null
    );

    await upsertReminderSetting(
      ReminderType.EVENT_REGISTRATION,
      parseReminderOffsets(String(eventReminderOffsets ?? ""))
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update settings." }, { status: 500 });
  }
}
