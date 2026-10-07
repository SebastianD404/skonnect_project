export const AUDIT_TIME_RANGES = ["24h", "7d", "30d", "90d", "all"] as const;

export type AuditTimeRange = (typeof AUDIT_TIME_RANGES)[number];

export function isAuditTimeRange(value: string): value is AuditTimeRange {
  return AUDIT_TIME_RANGES.includes(value as AuditTimeRange);
}

export function getAuditStartDate(range: AuditTimeRange, now = new Date()): Date | undefined {
  const durationByRange: Partial<Record<AuditTimeRange, number>> = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    "90d": 90 * 24 * 60 * 60 * 1000,
  };
  const duration = durationByRange[range];
  return duration === undefined ? undefined : new Date(now.getTime() - duration);
}
