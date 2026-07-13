export type ReminderOffset = number;

export interface ReminderMessage {
  subject: string;
  body: string;
}

export function parseReminderOffsets(value: string | null | undefined): ReminderOffset[] {
  if (!value) return [];

  return value
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((offset) => Number.isInteger(offset) && offset > 0);
}

export function getReminderDates(baseDate: Date, offsets: ReminderOffset[]): Date[] {
  return offsets.map((offset) => {
    const reminderDate = new Date(baseDate);
    reminderDate.setUTCDate(reminderDate.getUTCDate() - offset);
    reminderDate.setUTCHours(0, 0, 0, 0);
    return reminderDate;
  });
}

export function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function shouldSendReminder(reminderDate: Date, now: Date): boolean {
  return formatUtcDate(reminderDate) === formatUtcDate(now);
}

export function buildSkeapReminderMessage(offset: ReminderOffset, deadline: Date): ReminderMessage {
  const deadlineDate = formatUtcDate(deadline);
  return {
    subject: `SKEAP deadline in ${offset} day${offset === 1 ? "" : "s"}`,
    body: `Your SKEAP submission deadline is ${deadlineDate}. Please submit your required documents ${offset === 1 ? "by tomorrow" : `in ${offset} days`} to stay on track.`,
  };
}

export function buildEventReminderMessage(offset: ReminderOffset, title: string, eventDate: Date): ReminderMessage {
  const eventDateString = formatUtcDate(eventDate);
  return {
    subject: `Upcoming event: ${title} in ${offset} day${offset === 1 ? "" : "s"}`,
    body: `You are registered for ${title} on ${eventDateString}. Please plan to attend and arrive on time.`,
  };
}
