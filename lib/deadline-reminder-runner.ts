import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildAcademicTermReminderMessage,
  formatUtcDate,
  getReminderDates,
  renderMessageTemplate,
} from "@/lib/reminders";
import { getAcademicTermDeadlineTarget } from "@/lib/academic-term-schedule";
import { getCurrentAcademicSemester, getPreviousAcademicSemester } from "@/lib/semester-progress";
import { createGmailTransporter, sendTransactionalEmail } from "@/lib/broadcast-email";

const EMAIL_CHANNEL = "email";
const IN_APP_CHANNEL = "in-app";
const REMINDER_TYPE_SKEAP_APPLICATION = "SKEAP_APPLICATION" as const;
const DEFAULT_SKEAP_OFFSETS = [7, 3, 1];
const TARGET_TYPE = "ACADEMIC_TERM_DEADLINE";
const DAY_MS = 24 * 60 * 60 * 1000;

type ReminderType = typeof REMINDER_TYPE_SKEAP_APPLICATION;
type ReminderTerm = {
  id: string;
  semester: string;
  opensAt: Date;
  closesAt: Date;
};
type ReminderMessageTemplate = {
  subject: string;
  body: string;
};

export type DeadlineReminderSettings = {
  skeapOffsets: number[];
  messageTemplate?: ReminderMessageTemplate | null;
};

type ReminderLogInput = {
  userId: string;
  reminderType: ReminderType;
  targetType: string;
  targetId: string | null;
  channel: string;
  triggerDate: Date;
  metadata: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  success: boolean;
};

export type ReminderRunResult = {
  dueOffsets: number[];
  emailSent: number;
  emailFailed: number;
  emailSkipped: number;
  inAppCreated: number;
};

const EMPTY_RESULT: ReminderRunResult = {
  dueOffsets: [],
  emailSent: 0,
  emailFailed: 0,
  emailSkipped: 0,
  inAppCreated: 0,
};

export async function loadReminderSettings(): Promise<DeadlineReminderSettings> {
  const [skeapSetting, messageTemplate] = await Promise.all([
    prisma.reminderSetting.findUnique({ where: { type: REMINDER_TYPE_SKEAP_APPLICATION } }),
    prisma.messageTemplate.findUnique({
      where: { type_channel: { type: "DEADLINE_REMINDER", channel: "EMAIL" } },
      select: { subject: true, body: true },
    }),
  ]);
  const configuredOffsets = skeapSetting?.offsets ?? [];

  return {
    skeapOffsets: skeapSetting?.active === false
      ? []
      : configuredOffsets.length > 0
        ? Array.from(new Set(configuredOffsets.filter((offset) => Number.isInteger(offset) && offset > 0)))
        : DEFAULT_SKEAP_OFFSETS,
    messageTemplate,
  };
}

export async function sendReminderLogs({
  userId,
  reminderType,
  targetType,
  targetId,
  channel,
  triggerDate,
  metadata,
  success,
}: ReminderLogInput) {
  const where = { userId, reminderType, targetType, targetId, triggerDate, channel };
  const existing = await prisma.reminderLog.findFirst({
    where,
    select: { id: true },
  });
  const data = { ...where, metadata, success, sentAt: new Date() };
  const log = existing
    ? await prisma.reminderLog.update({ where: { id: existing.id }, data })
    : await prisma.reminderLog.create({ data });

  if (channel === IN_APP_CHANNEL) {
    const metadataRecord = typeof metadata === "object" && metadata !== null && !Array.isArray(metadata)
      ? metadata as Record<string, unknown>
      : {};
    const subject = typeof metadataRecord.subject === "string" ? metadataRecord.subject : "SKEAP deadline reminder";
    const body = typeof metadataRecord.body === "string" ? metadataRecord.body : "A SKEAP submission deadline is approaching.";
    const sourceKey = `reminder:${log.id}`;

    await prisma.notification.upsert({
      where: { userId_sourceKey: { userId, sourceKey } },
      create: { userId, sourceKey, message: `${subject}: ${body}` },
      update: { message: `${subject}: ${body}` },
    });
  }

  return log;
}

async function getGranteesWithSkeapAccess() {
  return prisma.user.findMany({
    where: {
      role: "GRANTEE",
      isActive: true,
      grantee: { is: { status: { in: ["ACTIVE", "PROBATIONARY"] } } },
    },
    select: {
      id: true,
      email: true,
      emailNotifications: true,
      grantee: { select: { id: true } },
    },
  });
}

function getDueOffsets(offsets: number[], deadline: Date, now: Date) {
  const today = formatUtcDate(now);
  const deadlineDay = formatUtcDate(deadline);
  if (today >= deadlineDay) return [];

  const candidates = offsets
    .map((offset) => ({ offset, triggerDate: getReminderDates(deadline, [offset])[0] }))
    .filter(({ triggerDate }) => formatUtcDate(triggerDate) <= today);
  const onTime = candidates.filter(({ triggerDate }) => formatUtcDate(triggerDate) === today);
  if (onTime.length > 0) return onTime;

  return candidates
    .sort((a, b) => b.triggerDate.getTime() - a.triggerDate.getTime())
    .slice(0, 1);
}

function getRemainingDays(deadline: Date, now: Date) {
  const deadlineDay = Date.parse(`${formatUtcDate(deadline)}T00:00:00.000Z`);
  const today = Date.parse(`${formatUtcDate(now)}T00:00:00.000Z`);
  return Math.max(1, Math.ceil((deadlineDay - today) / DAY_MS));
}

function getMessage(
  settings: DeadlineReminderSettings,
  targetTerm: ReminderTerm,
  offset: number,
  remainingDays: number,
  now: Date,
) {
  const currentSemester = targetTerm.semester || getCurrentAcademicSemester(now);
  const fallbackMessage = buildAcademicTermReminderMessage(
    remainingDays,
    currentSemester,
    targetTerm.closesAt,
  );
  const template = settings.messageTemplate;
  if (!template) return fallbackMessage;

  const deadlineDate = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "long",
  }).format(targetTerm.closesAt);
  const deadlineTime = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  }).format(targetTerm.closesAt);
  const values = {
    deadline_date: deadlineDate,
    deadline_time: deadlineTime,
    current_semester: currentSemester,
    last_semester: getPreviousAcademicSemester(currentSemester) ?? "",
    days_remaining: String(remainingDays),
    reminder_offset: String(offset),
  };

  return {
    subject: template.subject.trim()
      ? renderMessageTemplate(template.subject, values)
      : fallbackMessage.subject,
    body: template.body.trim()
      ? renderMessageTemplate(template.body, values)
      : fallbackMessage.body,
  };
}

export async function processSkeapReminders(
  settings: DeadlineReminderSettings,
  now: Date,
): Promise<ReminderRunResult> {
  if (settings.skeapOffsets.length === 0) return EMPTY_RESULT;

  const schedules = await prisma.academicTermSchedule.findMany({
    orderBy: { opensAt: "asc" },
    select: { id: true, semester: true, opensAt: true, closesAt: true },
  }) as ReminderTerm[];
  const targetTerm = getAcademicTermDeadlineTarget(schedules, now);
  if (!targetTerm) return EMPTY_RESULT;

  const dueOffsets = getDueOffsets(settings.skeapOffsets, targetTerm.closesAt, now);
  if (dueOffsets.length === 0) return EMPTY_RESULT;

  const grantees = await getGranteesWithSkeapAccess();
  const result: ReminderRunResult = {
    ...EMPTY_RESULT,
    dueOffsets: dueOffsets.map(({ offset }) => offset),
  };
  const remainingDays = getRemainingDays(targetTerm.closesAt, now);
  let transporter: ReturnType<typeof createGmailTransporter> | null = null;

  for (const grantee of grantees) {
    for (const { offset, triggerDate } of dueOffsets) {
      const message = getMessage(settings, targetTerm, offset, remainingDays, now);
      const reminderMetadata = {
        subject: message.subject,
        body: message.body,
        offset,
        daysRemaining: remainingDays,
      };
      const logWhere = {
        userId: grantee.id,
        reminderType: REMINDER_TYPE_SKEAP_APPLICATION,
        targetType: TARGET_TYPE,
        targetId: targetTerm.id,
        triggerDate,
        channel: EMAIL_CHANNEL,
      };
      const previousEmailLog = await prisma.reminderLog.findFirst({
        where: logWhere,
        select: { success: true, metadata: true },
      });
      const previousMetadata = previousEmailLog?.metadata;
      const previousDeliveryStatus =
        typeof previousMetadata === "object" && previousMetadata !== null && !Array.isArray(previousMetadata)
          ? (previousMetadata as Record<string, unknown>).deliveryStatus
          : null;

      if (previousEmailLog?.success && (previousDeliveryStatus === "sent" || previousDeliveryStatus === "skipped")) {
        result.emailSkipped += 1;
      } else if (!grantee.email || !grantee.emailNotifications) {
        await sendReminderLogs({
          ...logWhere,
          metadata: { ...reminderMetadata, deliveryStatus: "skipped" },
          success: true,
        });
        result.emailSkipped += 1;
      } else {
        try {
          transporter ??= createGmailTransporter();
          await sendTransactionalEmail(
            transporter,
            grantee.email,
            message.subject,
            message.body,
            `${targetTerm.id}-${grantee.id}-${triggerDate.toISOString()}`,
          );
          await sendReminderLogs({
            ...logWhere,
            metadata: { ...reminderMetadata, deliveryStatus: "sent" },
            success: true,
          });
          result.emailSent += 1;
        } catch (error) {
          console.error(`Failed to send SKEAP deadline reminder to ${grantee.email}:`, error);
          await sendReminderLogs({
            ...logWhere,
            metadata: {
              ...reminderMetadata,
              deliveryStatus: "failed",
              error: error instanceof Error ? error.message : "Unknown email delivery error",
            },
            success: false,
          });
          result.emailFailed += 1;
        }
      }

      await sendReminderLogs({
        userId: grantee.id,
        reminderType: REMINDER_TYPE_SKEAP_APPLICATION,
        targetType: TARGET_TYPE,
        targetId: targetTerm.id,
        channel: IN_APP_CHANNEL,
        triggerDate,
        metadata: reminderMetadata,
        success: true,
      });
      result.inAppCreated += 1;
    }
  }

  return result;
}

export async function runDeadlineReminders(now = new Date()) {
  const settings = await loadReminderSettings();
  return processSkeapReminders(settings, now);
}
