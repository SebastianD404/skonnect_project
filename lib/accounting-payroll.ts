export function formatPayrollGranteeName(
  profile: { lastName: string; firstName: string; middleName: string | null } | null,
  fallbackFullName: string,
) {
  if (!profile?.lastName.trim() || !profile.firstName.trim()) {
    return fallbackFullName.trim().toUpperCase();
  }

  const middleInitial = profile.middleName?.trim().charAt(0);
  return `${profile.lastName.trim()}, ${profile.firstName.trim()}${middleInitial ? ` ${middleInitial}.` : ""}`
    .toUpperCase();
}
