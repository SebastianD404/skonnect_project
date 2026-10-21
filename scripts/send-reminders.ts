import "dotenv/config";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  buildAcademicTermReminderMessage,
  getReminderDates,
  renderMessageTemplate,
  shouldSendReminder,
} from "../lib/reminders";
import { getAcademicTermDeadlineTarget } from "../lib/academic-term-schedule";
import { getCurrentAcademicSemester, getPreviousAcademicSemester } from "../lib/semester-progress";

const EMAIL_CHANNEL = "email";
const IN_APP_CHANNEL = "in-app";
const REMINDER_TYPE_SKEAP_APPLICATION = "SKEAP_APPLICATION" as const;

type ReminderType = typeof REMINDER_TYPE_SKEAP_APPLICATION;
type ReminderTerm = {
  id: string;
  semester: string;
  opensAt: Date;
  closesAt: Date;
};

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

async function loadReminderSettings(): Promise<{
  skeapOffsets: number[];
  messageTemplate?: { subject: string; body: string } | null;
}> {
  const [skeapSetting, messageTemplate] = await Promise.all([
    prisma.reminderSetting.findUnique({ where: { type: REMINDER_TYPE_SKEAP_APPLICATION } }),
    prisma.messageTemplate.findUnique({
      where: { type_channel: { type: "DEADLINE_REMINDER", channel: "EMAIL" } },
      select: { subject: true, body: true },
    }),
  ]);

  return {
    skeapOffsets: skeapSetting?.offsets ?? [],
    messageTemplate,
  };
}

async function sendEmailStub(email: string, subject: string, body: string) {
  console.log(`Email stub sending to ${email}: ${subject}`);
  console.log(body);
  return true;
}

export async function processSkeapReminders(settings: Awaited<ReturnType<typeof loadReminderSettings>>, now: Date) {
  if (settings.skeapOffsets.length === 0) {
    return;
  }

  const schedules = await prisma.academicTermSchedule.findMany({
    orderBy: { opensAt: "asc" },
    select: { id: true, semester: true, opensAt: true, closesAt: true },
  }) as ReminderTerm[];
  const targetTerm = getAcademicTermDeadlineTarget(schedules, now);
  if (!targetTerm) return;

  const reminderDates = getReminderDates(targetTerm.closesAt, settings.skeapOffsets);
  const dueOffsets = settings.skeapOffsets.filter((offset, index) => shouldSendReminder(reminderDates[index], now));
  if (dueOffsets.length === 0) return;

  const grantees = await getGranteesWithSkeapAccess();
  await Promise.all(
    grantees.map(async (grantee) => {
      if (!grantee.email) return;
      for (const offset of dueOffsets) {
        const reminderDate = getReminderDates(targetTerm.closesAt, [offset])[0];
        const fallbackMessage = buildAcademicTermReminderMessage(offset, targetTerm.semester, targetTerm.closesAt);
        const deadlineDate = new Intl.DateTimeFormat("en-PH", {
          timeZone: "Asia/Manila",
          dateStyle: "long",
        }).format(targetTerm.closesAt);
        const deadlineTime = new Intl.DateTimeFormat("en-PH", {
          timeZone: "Asia/Manila",
          hour: "numeric",
          minute: "2-digit",
        }).format(targetTerm.closesAt);
        const currentSemester = targetTerm.semester || getCurrentAcademicSemester(now);
        const values = {
          deadline_date: deadlineDate,
          deadline_time: deadlineTime,
          current_semester: currentSemester,
          last_semester: getPreviousAcademicSemester(currentSemester) ?? "",
        };
        const message = settings.messageTemplate
          ? {
              subject: renderMessageTemplate(settings.messageTemplate.subject, values),
              body: renderMessageTemplate(settings.messageTemplate.body, values),
            }
          : fallbackMessage;
        await sendEmailStub(grantee.email, message.subject, message.body);
        await sendReminderLogs(
          grantee.id,
          REMINDER_TYPE_SKEAP_APPLICATION,
          "ACADEMIC_TERM_DEADLINE",
          targetTerm.id,
          EMAIL_CHANNEL,
          reminderDate,
          { subject: message.subject, body: message.body }
        );
        await sendReminderLogs(
          grantee.id,
          REMINDER_TYPE_SKEAP_APPLICATION,
          "ACADEMIC_TERM_DEADLINE",
          targetTerm.id,
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
