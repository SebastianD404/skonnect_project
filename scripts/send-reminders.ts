import "dotenv/config";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  buildEventReminderMessage,
  buildSkeapReminderMessage,
  formatUtcDate,
  getReminderDates,
  shouldSendReminder,
} from "../lib/reminders";

const EMAIL_CHANNEL = "email";
const IN_APP_CHANNEL = "in-app";
const REMINDER_TYPE_SKEAP_APPLICATION = "SKEAP_APPLICATION" as const;
const REMINDER_TYPE_EVENT_REGISTRATION = "EVENT_REGISTRATION" as const;

type ReminderType = typeof REMINDER_TYPE_SKEAP_APPLICATION | typeof REMINDER_TYPE_EVENT_REGISTRATION;

function normalizeDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(`${String(value)}T00:00:00.000Z`);
}

function isPastDate(date: Date, now: Date) {
  return date.getTime() < now.getTime();
}

export async function sendReminderLogs(userId: string, reminderType: ReminderType, targetType: string, targetId: string | null, channel: string, triggerDate: Date, metadata: Prisma.JsonValue) {
  return prisma.reminderLog.create({
    data: {
      userId,
      reminderType,
      targetType,
      targetId,
      triggerDate,
      channel,
      metadata,
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

async function getActiveEventRegistrations() {
  return prisma.registration.findMany({
    where: {
      event: { status: { in: ["UPCOMING", "REGISTRATION_OPEN"] } },
    },
    include: { event: true, user: true },
  });
}

async function loadReminderSettings() {
  const [skeapSetting, eventSetting] = await Promise.all([
    prisma.reminderSetting.findUnique({ where: { type: REMINDER_TYPE_SKEAP_APPLICATION } }),
    prisma.reminderSetting.findUnique({ where: { type: REMINDER_TYPE_EVENT_REGISTRATION } }),
  ]);

  return {
    skeapOffsets: skeapSetting?.offsets ?? [],
    skeapDeadline: normalizeDate(skeapSetting?.deadline),
    eventOffsets: eventSetting?.offsets ?? [],
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

export async function processEventReminders(settings: Awaited<ReturnType<typeof loadReminderSettings>>, now: Date) {
  if (settings.eventOffsets.length === 0) {
    return;
  }

  const registrations = await getActiveEventRegistrations();
  await Promise.all(
    registrations.map(async (registration) => {
      const eventDate = normalizeDate(registration.event.eventDate);
      if (!eventDate) return;
      const reminderDates = getReminderDates(eventDate, settings.eventOffsets);
      settings.eventOffsets.forEach(async (offset, index) => {
        const reminderDate = reminderDates[index];
        if (!shouldSendReminder(reminderDate, now)) return;

        const message = buildEventReminderMessage(offset, registration.event.title, eventDate);
        if (!registration.user.email) return;

        await sendEmailStub(registration.user.email, message.subject, message.body);
        await sendReminderLogs(
          registration.user.id,
          REMINDER_TYPE_EVENT_REGISTRATION,
          "EVENT_REGISTRATION",
          registration.event.id,
          EMAIL_CHANNEL,
          reminderDate,
          {
            eventId: registration.event.id,
            eventTitle: registration.event.title,
            subject: message.subject,
            body: message.body,
          }
        );
        await sendReminderLogs(
          registration.user.id,
          REMINDER_TYPE_EVENT_REGISTRATION,
          "EVENT_REGISTRATION",
          registration.event.id,
          IN_APP_CHANNEL,
          reminderDate,
          {
            eventId: registration.event.id,
            eventTitle: registration.event.title,
            subject: message.subject,
            body: message.body,
          }
        );
      });
    })
  );
}

async function main() {
  const now = new Date();
  const settings = await loadReminderSettings();
  await processSkeapReminders(settings, now);
  await processEventReminders(settings, now);
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
