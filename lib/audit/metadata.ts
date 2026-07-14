export type AuditRoleChangeContext = {
  targetUserId: string;
  targetUserName: string;
  targetUserEmail: string;
  oldRole: string;
  newRole: string;
  ipAddress: string;
  userAgent: string;
};

export type AuditTargetContext = {
  label: string;
  secondary: string;
  id: string;
};

type JsonRecord = Record<string, unknown>;

type AuditLike = {
  action: string;
  targetTable?: string;
  targetId: string;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: unknown;
  meta?: unknown;
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

export function getAuditActionSummary(audit: AuditLike): string {
  const metadata = parseRecord(audit.metadata);
  const meta = parseRecord(audit.meta);
  const directReason = getString(metadata, "reason") || getString(meta, "reason");
  if (directReason) return directReason;

  const action = audit.action;
  if (action === "FLAG_SUBMISSION_FOR_CORRECTION") {
    return "Submission sent back for correction.";
  }

  if (action === "EXPORT_KK_PROFILING_DATA") {
    return "KK profiling export initiated.";
  }

  if (action === "MANUAL_PROFILE_UPDATE") {
    return "Administrative profile changes recorded.";
  }

  return "";
}

export function getAuditTargetContext(audit: AuditLike): AuditTargetContext {
  const metadata = parseRecord(audit.metadata);
  const meta = parseRecord(audit.meta);
  const before = parseRecord(audit.beforeData);
  const after = parseRecord(audit.afterData);

  const label =
    getString(metadata, "target") ||
    getString(meta, "target") ||
    getString(metadata, "targetUserName") ||
    getString(meta, "targetUserName") ||
    getString(after, "fullName") ||
    getString(before, "fullName") ||
    getString(after, "email") ||
    getString(before, "email") ||
    audit.targetTable ||
    "Unknown target";

  const secondary =
    getString(metadata, "targetEmail") ||
    getString(meta, "targetEmail") ||
    getString(metadata, "targetUserEmail") ||
    getString(meta, "targetUserEmail") ||
    getString(metadata, "email") ||
    getString(meta, "email") ||
    (label !== audit.targetTable ? audit.targetTable : audit.targetId) ||
    "";

  return {
    label,
    secondary,
    id: getString(metadata, "targetId") || getString(meta, "targetId") || audit.targetId,
  };
}

export function shortAuditId(value: string): string {
  if (!value) return "unknown";
  return `${value.slice(0, 8)}...`;
}

export function getAuditHumanSummary(audit: AuditLike, actorLabel?: string): string {
  const roleContext = getAuditRoleChangeContext(audit);
  const target = roleContext.targetUserName || roleContext.targetUserEmail || audit.targetId;
  const actor = actorLabel || "System";

  if (audit.action === "UPDATE_USER_ROLE" || audit.action === "ROLE_UPDATED") {
    const oldRole = roleContext.oldRole || "Unknown";
    const newRole = roleContext.newRole || "Unknown";
    return `${actor} changed role for ${target} from ${oldRole} to ${newRole}.`;
  }

  if (audit.action === "APPROVE_SKEAP_APPLICATION") {
    return `${actor} approved application for ${target}.`;
  }

  if (audit.action === "FLAG_SUBMISSION_FOR_CORRECTION") {
    return `${actor} flagged a submission for correction for ${target}.`;
  }

  const meta = parseRecord(audit.metadata || audit.meta);
  if (meta && Object.keys(meta).length > 0) {
    const verb = audit.action.replace(/_/g, " ").toLowerCase();
    return `${actor} performed ${verb} on ${target}.`;
  }

  return `${actor} performed ${audit.action.replace(/_/g, " ")} on ${audit.targetTable || audit.targetId}.`;
}

export function getAuditChanges(audit: AuditLike): { field: string; before: string; after: string }[] {
  const before = parseRecord(audit.beforeData);
  const after = parseRecord(audit.afterData);
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  const changes: { field: string; before: string; after: string }[] = [];

  for (const key of keys) {
    const b = before[key];
    const a = after[key];
    const bStr = b === undefined || b === null ? "—" : String(b);
    const aStr = a === undefined || a === null ? "—" : String(a);
    if (bStr !== aStr) {
      changes.push({ field: key, before: bStr, after: aStr });
    }
  }

  return changes;
}

export function parseUserAgentLabel(userAgent?: string): string {
  if (!userAgent) return "Unknown device";
  const ua = userAgent.toLowerCase();
  if (ua.includes("windows")) {
    if (ua.includes("chrome")) return "Chrome on Windows";
    if (ua.includes("firefox")) return "Firefox on Windows";
    return "Browser on Windows";
  }
  if (ua.includes("macintosh") || ua.includes("mac os x")) {
    if (ua.includes("safari") && !ua.includes("chrome")) return "Safari on macOS";
    return "Browser on macOS";
  }
  if (ua.includes("android")) return "Browser on Android";
  if (ua.includes("iphone") || ua.includes("ipad")) return "Browser on iOS";
  if (ua.includes("chrome")) return "Chrome";
  if (ua.includes("safari")) return "Safari";
  return "Unknown device";
}
