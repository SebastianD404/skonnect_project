export function getExactAge(birthDate: Date | null | undefined, today = new Date()) {
  if (!birthDate || Number.isNaN(birthDate.getTime())) return null;
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  if (
    today.getUTCMonth() < birthDate.getUTCMonth() ||
    (today.getUTCMonth() === birthDate.getUTCMonth() &&
      today.getUTCDate() < birthDate.getUTCDate())
  ) {
    age -= 1;
  }
  return age;
}
