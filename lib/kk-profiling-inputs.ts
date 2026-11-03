export function removeNameNumbers(value: string) {
  return value.replace(/\p{N}/gu, "");
}

export function keepContactNumberDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function isValidNameInput(value: string) {
  const trimmed = value.trim();
  return !/\p{N}/u.test(trimmed) && (trimmed.match(/\p{L}/gu)?.length ?? 0) >= 2;
}

export function isValidContactNumber(value: string) {
  return /^\d+$/.test(value.trim());
}
