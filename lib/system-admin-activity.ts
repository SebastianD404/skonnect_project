export type AuditActivityModuleRow = {
  targetTable: string | null;
  action: string;
  eventCount: number | bigint;
};

export type SystemActivityModuleCount = {
  label: string;
  count: number;
  breakdown?: string;
};

function titleCaseEntityLabel(value: string) {
  const label = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  return label
    .replace(/\bKk\b/g, "KK")
    .replace(/\bApi\b/g, "API")
    .replace(/\bSkeap\b/g, "SKEAP");
}

export function normalizeAuditActivityModule(
  targetTable: string | null,
  action: string,
) {
  const table = (targetTable ?? "").toLowerCase();
  const auditAction = action.toLowerCase();

  if (table.includes("waitlist") || auditAction.includes("waitlist")) return "Waitlist";
  if (table.includes("backup") || auditAction.includes("backup")) return "Backups";
  if (
    table.includes("knowledge") ||
    table.includes("chat_embedding") ||
    auditAction.includes("knowledge_base")
  ) {
    return "Knowledge Base";
  }
  if (
    table.includes("academic_term_schedule") ||
    table.includes("term_schedule") ||
    auditAction.includes("academic_term_schedule")
  ) {
    return "Term Schedules";
  }
  if (table.includes("accounting") || table.includes("payout")) return "Accounting";
  if (table.includes("kk") || table.includes("profil") || table.includes("member")) {
    return "KK Profiles";
  }
  if (table.includes("user")) return "Users";
  if (table.includes("grantee")) return "Grantees";
  if (table.includes("skeap")) return "SKEAP Applications";
  if (table.includes("submission") || table.includes("application")) return "Submissions";

  return titleCaseEntityLabel(targetTable || "Other");
}

export function aggregateAuditActivityModules(
  rows: AuditActivityModuleRow[],
  limit = 5,
): SystemActivityModuleCount[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const label = normalizeAuditActivityModule(row.targetTable, row.action);
    counts.set(label, (counts.get(label) ?? 0) + Number(row.eventCount));
  }

  const sortedModules = [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  const modules: SystemActivityModuleCount[] = sortedModules.slice(0, limit);
  const smallerModules = sortedModules.slice(limit);
  const otherCount = smallerModules.reduce((total, module) => total + module.count, 0);

  if (otherCount > 0) {
    modules.push({
      label: "Other Modules",
      count: otherCount,
      breakdown: smallerModules
        .map((module) => `${module.label}: ${module.count.toLocaleString("en-PH")}`)
        .join(" · "),
    });
  }

  return modules;
}
