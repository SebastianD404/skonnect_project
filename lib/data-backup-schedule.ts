const PHT_TIME_ZONE = "Asia/Manila";
const PHT_UTC_OFFSET_HOURS = 8;
export const TARGET_HOUR_PHT = 20;
export const TARGET_MINUTE_PHT = 15;

function getPhtCalendarDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PHT_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
  return {
    year: values.year,
    month: values.month,
    day: values.day,
  };
}

export function getPhtDateString(date: Date) {
  const { year, month, day } = getPhtCalendarDate(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getPhtTime(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PHT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
  return { hour: values.hour, minute: values.minute };
}

export function isPhtTimeAtOrAfterBackupTarget(hour: number, minute: number) {
  return hour > TARGET_HOUR_PHT ||
    (hour === TARGET_HOUR_PHT && minute >= TARGET_MINUTE_PHT);
}

function phtMidnightUtc(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day) - PHT_UTC_OFFSET_HOURS * 60 * 60 * 1000);
}

export function getPhtDayBounds(date: Date) {
  const { year, month, day } = getPhtCalendarDate(date);
  return {
    start: phtMidnightUtc(year, month, day),
    end: phtMidnightUtc(year, month, day + 1),
  };
}
