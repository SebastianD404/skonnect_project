import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { Prisma, Role, ReminderType } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { ensureProfile } from "../../../lib/auth";
import { parseReminderOffsets } from "../../../lib/reminders";
import { writeAuditLog } from "../../../lib/audit/logger";

const DEFAULT_SETTINGS = {
  inquiryAlerts: true,
  submissionAlerts: true,
  skeapReminderOffsets: "7, 3, 1",
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

async function getAppUser(authUser: { id?: string; user?: { id?: string } }): Promise<AppUserWithSettings | null> {
  const linkedUser = await ensureProfile(authUser);
  if (!linkedUser) return null;
  const user = await prisma.user.findUnique({ where: { id: linkedUser.id } });
  return user as unknown as AppUserWithSettings | null;
}

async function getReminderSettings() {
  const skeap = await prisma.reminderSetting.findUnique({
    where: { type: ReminderType.SKEAP_APPLICATION },
  });

  const skeapOffsets = Array.isArray(skeap?.offsets) ? skeap.offsets : [];

  return {
    skeapReminderOffsets: skeapOffsets.length > 0 ? skeapOffsets.join(", ") : DEFAULT_SETTINGS.skeapReminderOffsets,
    skeapDeadline: skeap?.deadline?.toISOString() ?? null,
  };
}

async function upsertReminderSetting(
  client: Prisma.TransactionClient,
  type: ReminderType,
  offsets: number[],
  deadline: Date | null
) {
  return client.reminderSetting.upsert({
    where: { type },
    create: {
      type,
      offsets,
      deadline,
    },
    update: {
      offsets,
      deadline,
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
    skeapDeadline,
  } = payload;

  let parsedDeadline: Date | null = null;
  if (skeapDeadline !== null && skeapDeadline !== undefined && skeapDeadline !== "") {
    if (typeof skeapDeadline !== "string") {
      return NextResponse.json({ error: "Invalid SKEAP deadline." }, { status: 400 });
    }
    parsedDeadline = new Date(skeapDeadline);
    if (Number.isNaN(parsedDeadline.getTime())) {
      return NextResponse.json({ error: "Invalid SKEAP deadline." }, { status: 400 });
    }
  }

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
    const previousSettings = await getReminderSettings();
    const nextProfileSettings = {
      inquiryAlerts: Boolean(inquiryAlerts),
      submissionAlerts: Boolean(submissionAlerts),
    };

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: appUser.id },
        data: {
          fullName,
          email,
          settings: nextProfileSettings,
        } as unknown as Prisma.UserUpdateInput,
      });

      await upsertReminderSetting(
        tx,
        ReminderType.SKEAP_APPLICATION,
        parseReminderOffsets(String(skeapReminderOffsets ?? "")),
        parsedDeadline
      );

      await writeAuditLog(tx, {
        action: "UPDATE_ADMIN_PROFILE_SETTINGS",
        actorId: appUser.id,
        targetTable: "users",
        targetId: appUser.id,
        beforeData: {
          fullName: appUser.fullName,
          email: appUser.email,
          settings: appUser.settings,
        },
        afterData: {
          fullName,
          email,
          settings: nextProfileSettings,
        },
      });

      await writeAuditLog(tx, {
        action: "UPDATE_REMINDER_SETTINGS",
        actorId: appUser.id,
        targetTable: "reminder_settings",
        targetId: ReminderType.SKEAP_APPLICATION,
        beforeData: previousSettings,
        afterData: {
          skeapReminderOffsets,
          skeapDeadline: parsedDeadline?.toISOString() ?? null,
        },
        metadata: {
          target: appUser.fullName,
          targetId: appUser.id,
          skeapDeadline: parsedDeadline?.toISOString() ?? null,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update settings." }, { status: 500 });
  }
}
