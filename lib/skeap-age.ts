export function getExactAge(birthDate: Date | null | undefined, today = new Date()) {
  if (!birthDate || Number.isNaN(birthDate.getTime())) return null;
  const todayParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(today);
  const part = (type: string) => Number(todayParts.find((item) => item.type === type)?.value);
  let age = part("year") - birthDate.getUTCFullYear();
  const todayMonth = part("month") - 1;
  const todayDay = part("day");
  if (
    todayMonth < birthDate.getUTCMonth() ||
    (todayMonth === birthDate.getUTCMonth() &&
      todayDay < birthDate.getUTCDate())
  ) {
    age -= 1;
  }
  return age;
}

export function getAgeOutCutoffDate(today = new Date()) {
  const todayParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(today);
  const part = (type: string) => Number(todayParts.find((item) => item.type === type)?.value);
  return new Date(Date.UTC(part("year") - 31, part("month") - 1, part("day")));
}
