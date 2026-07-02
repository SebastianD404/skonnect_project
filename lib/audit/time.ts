const MANILA_TIMEZONE = "Asia/Manila";

type DateLike = Date | string;

function asValidDate(dateInput: DateLike): Date | null {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function twoDigit(value: number): string {
  return String(value).padStart(2, "0");
}

// Option A: Native Intl API with explicit Asia/Manila timezone lock.
export function formatPhilippineTime(dateInput: DateLike): string {
  const date = asValidDate(dateInput);
  if (!date) return "Invalid date";

  const formatter = new Intl.DateTimeFormat("en-PH", {
    timeZone: MANILA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const values: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second} PHT`;
}

// Option B: Fixed UTC+8 conversion (PHT has no DST).
export function formatPhilippineTimeUtcOffset(dateInput: DateLike): string {
  const date = asValidDate(dateInput);
  if (!date) return "Invalid date";

  const phtMillis = date.getTime() + 8 * 60 * 60 * 1000;
  const phtDate = new Date(phtMillis);

  const year = phtDate.getUTCFullYear();
  const month = twoDigit(phtDate.getUTCMonth() + 1);
  const day = twoDigit(phtDate.getUTCDate());
  const hour = twoDigit(phtDate.getUTCHours());
  const minute = twoDigit(phtDate.getUTCMinutes());
  const second = twoDigit(phtDate.getUTCSeconds());

  return `${year}-${month}-${day} ${hour}:${minute}:${second} PHT`;
}
