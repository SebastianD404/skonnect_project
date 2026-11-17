const PHT_TIME_ZONE = "Asia/Manila";
const PHT_UTC_OFFSET_HOURS = 8;

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
