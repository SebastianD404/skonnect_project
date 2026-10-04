export function isSkeapTestAccount(email: string | null | undefined) {
  return email?.trim().toLowerCase() === "test@example.com";
}
