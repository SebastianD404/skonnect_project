import "dotenv/config";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  buildSkeapReminderMessage,
  formatUtcDate,
  getReminderDates,
  shouldSendReminder,
} from "../lib/reminders";

const EMAIL_CHANNEL = "email";
const IN_APP_CHANNEL = "in-app";
const REMINDER_TYPE_SKEAP_APPLICATION = "SKEAP_APPLICATION" as const;

type ReminderType = typeof REMINDER_TYPE_SKEAP_APPLICATION;

function normalizeDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(`${String(value)}T00:00:00.000Z`);
}

function isPastDate(date: Date, now: Date) {
  return date.getTime() < now.getTime();
}

export async function sendReminderLogs(
  userId: string,
  reminderType: ReminderType,
  targetType: string,
  targetId: string | null,
  channel: string,
  triggerDate: Date,
  metadata: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput
) {
  return prisma.reminderLog.create({
    data: {
      userId,
      reminderType,
      targetType,
      targetId,
      triggerDate,
      channel,
      metadata: metadata as any,
      success: true,
    },
  });
}

async function getGranteesWithSkeapAccess() {
  return prisma.user.findMany({
    where: { role: "GRANTEE" },
    select: { id: true, email: true, fullName: true, grantee: { select: { id: true } } },
  });
}

async function loadReminderSettings() {
  const skeapSetting = await prisma.reminderSetting.findUnique({ where: { type: REMINDER_TYPE_SKEAP_APPLICATION } });

  return {
    skeapOffsets: skeapSetting?.offsets ?? [],
    skeapDeadline: normalizeDate(skeapSetting?.deadline),
  };
}

async function sendEmailStub(email: string, subject: string, body: string) {
  console.log(`Email stub sending to ${email}: ${subject}`);
  console.log(body);
  return true;
}

export async function processSkeapReminders(settings: Awaited<ReturnType<typeof loadReminderSettings>>, now: Date) {
  if (!settings.skeapDeadline || settings.skeapOffsets.length === 0) {
    return;
  }

  const reminderDates = getReminderDates(settings.skeapDeadline, settings.skeapOffsets);
  const dueOffsets = settings.skeapOffsets.filter((offset, index) => shouldSendReminder(reminderDates[index], now));
  if (dueOffsets.length === 0) return;

  const grantees = await getGranteesWithSkeapAccess();
  await Promise.all(
    grantees.map(async (grantee) => {
      if (!grantee.email) return;
      for (const offset of dueOffsets) {
        const reminderDate = getReminderDates(settings.skeapDeadline!, [offset])[0];
        const message = buildSkeapReminderMessage(offset, settings.skeapDeadline!);
        await sendEmailStub(grantee.email, message.subject, message.body);
        await sendReminderLogs(
          grantee.id,
          REMINDER_TYPE_SKEAP_APPLICATION,
          "SKEAP_APPLICATION_DEADLINE",
          null,
          EMAIL_CHANNEL,
          reminderDate,
          { subject: message.subject, body: message.body }
        );
        await sendReminderLogs(
          grantee.id,
          REMINDER_TYPE_SKEAP_APPLICATION,
          "SKEAP_APPLICATION_DEADLINE",
          null,
          IN_APP_CHANNEL,
          reminderDate,
          { subject: message.subject, body: message.body }
        );
      }
    })
  );
}

async function main() {
  const now = new Date();
  const settings = await loadReminderSettings();
  await processSkeapReminders(settings, now);
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error("Reminder runner failed:", error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
