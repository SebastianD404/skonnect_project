export type AuditRoleChangeContext = {
  targetUserId: string;
  targetUserName: string;
  targetUserEmail: string;
  oldRole: string;
  newRole: string;
  ipAddress: string;
  userAgent: string;
};

type JsonRecord = Record<string, unknown>;

type AuditLike = {
  action: string;
  targetId: string;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: unknown;
};

function parseRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function getString(data: JsonRecord, key: string): string {
  const value = data[key];
  return typeof value === "string" ? value : "";
}

export function getAuditRoleChangeContext(audit: AuditLike): AuditRoleChangeContext {
  const before = parseRecord(audit.beforeData);
  const after = parseRecord(audit.afterData);
  const metadata = parseRecord(audit.metadata);

  return {
    targetUserId: getString(metadata, "targetUserId") || audit.targetId,
    targetUserName:
      getString(metadata, "targetUserName") ||
      getString(after, "fullName") ||
      getString(before, "fullName"),
    targetUserEmail:
      getString(metadata, "targetUserEmail") ||
      getString(after, "email") ||
      getString(before, "email"),
    oldRole: getString(metadata, "oldRole") || getString(before, "role"),
    newRole: getString(metadata, "newRole") || getString(after, "role"),
    ipAddress: getString(metadata, "ipAddress"),
    userAgent: getString(metadata, "userAgent"),
  };
}

export function shortAuditId(value: string): string {
  if (!value) return "unknown";
  return `${value.slice(0, 8)}...`;
}
