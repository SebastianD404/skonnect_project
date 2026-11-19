import type { Role } from "@prisma/client";
import type { PlatformAccountMetricKey } from "@/lib/platform-metrics";

type PlatformAccountExportCohort = {
  label: string;
  slug: string;
};

const ROLE_EXPORT_COHORTS: Record<Role, PlatformAccountExportCohort> = {
  YOUTH: { label: "Youth", slug: "youth" },
  GRANTEE: { label: "Grantees", slug: "grantees" },
  SK_OFFICIAL: { label: "SK Officials", slug: "sk-officials" },
  SUPER_ADMIN: { label: "Super Admins", slug: "super-admins" },
};

const METRIC_EXPORT_COHORTS: Record<PlatformAccountMetricKey, PlatformAccountExportCohort> = {
  all: { label: "All", slug: "all-users" },
  verified: {
    label: "Verified KK Youth & Grantees",
    slug: "verified-kk-youth-and-grantees",
  },
  pending: { label: "Pending", slug: "pending" },
  adminStaff: { label: "Privileged", slug: "privileged" },
  archived: { label: "Archived", slug: "archived" },
};

export function getPlatformAccountExportCohort(
  metric: PlatformAccountMetricKey,
  role: Role | null,
): PlatformAccountExportCohort {
  return role ? ROLE_EXPORT_COHORTS[role] : METRIC_EXPORT_COHORTS[metric];
}

export function getExportButtonLabel({
  count,
  metric,
  role,
  searchQuery,
}: {
  count: number;
  metric: PlatformAccountMetricKey;
  role: Role | null;
  searchQuery: string;
}) {
  const cohortLabel = getPlatformAccountExportCohort(metric, role).label;
  const label = searchQuery.trim()
    ? `Export Matching${cohortLabel === "All" ? "" : ` ${cohortLabel}`}`
    : `Export ${cohortLabel}`;
  return `${label} (${count.toLocaleString()})`;
}
