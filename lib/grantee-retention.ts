type RetentionDateValue = string | Date | null | undefined;

type GranteeRetentionDates = {
  retentionExpiresAt?: RetentionDateValue;
  graduatedAt?: RetentionDateValue;
};

function parseRetentionDate(value: RetentionDateValue): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value);
  }
  if (typeof value !== "string" || value.trim() === "") return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getRetentionExpiryDate(grantee: GranteeRetentionDates): Date | null {
  const storedExpiry = parseRetentionDate(grantee.retentionExpiresAt);
  if (storedExpiry) return storedExpiry;

  const graduatedAt = parseRetentionDate(grantee.graduatedAt);
  if (!graduatedAt) return null;

  const year = graduatedAt.getUTCFullYear() + 5;
  const month = graduatedAt.getUTCMonth();
  const day = graduatedAt.getUTCDate();
  const lastDayOfTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  return new Date(Date.UTC(
    year,
    month,
    Math.min(day, lastDayOfTargetMonth),
    graduatedAt.getUTCHours(),
    graduatedAt.getUTCMinutes(),
    graduatedAt.getUTCSeconds(),
    graduatedAt.getUTCMilliseconds()
  ));
}