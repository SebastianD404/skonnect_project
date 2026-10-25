export function isSkeapTestAccount(email: string | null | undefined) {
  const normalizedEmail = email?.trim().toLowerCase();
  return normalizedEmail === "test@example.com" || normalizedEmail === "test2@example.com";
}
