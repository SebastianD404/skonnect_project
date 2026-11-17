import { GranteeStatus, Prisma, Role, SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type PlatformAccountMetricKey =
  | "all"
  | "verified"
  | "pending"
  | "adminStaff"
  | "archived";

export type PlatformAccountMetrics = {
  totalAccounts: number;
  activeKkYouthAndGrantees: number;
  unprofiledOrPending: number;
  adminStaff: number;
  archivedOrInactive: number;
};

export type PlatformAccountUserRow = {
  id: string;
  fullName: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  username: string | null;
  phoneNumber: string | null;
  barangay: string;
  languagePref: string;
  skeapStatus: "Active Scholar" | "Waitlisted" | "Revoked" | "N/A";
  skeapApplicationStatus: SubmissionStatus | null;
  granteeStatus: GranteeStatus | null;
  granteeSchool: string | null;
  granteeYearLevel: string | null;
  granteeGeneralAverage: number | null;
  granteeDateEnrolled: Date | null;
  granteeArchivedAt: Date | null;
  granteeRetentionExpiresAt: Date | null;
};

type SegmentCount = {
  segment: string;
  count: bigint;
};

type UserCount = {
  count: bigint;
};

const METRIC_SEGMENTS: Record<Exclude<PlatformAccountMetricKey, "all">, string> = {
  verified: "VERIFIED_KK",
  pending: "PENDING_UNPROFILED",
  adminStaff: "ADMIN_STAFF",
  archived: "ARCHIVED_INACTIVE",
};

const CATEGORIZED_USERS_CTE = Prisma.sql`
  WITH categorized_users AS (
    SELECT
      account.*,
      CASE
        WHEN account."is_active"
          AND account."role" IN ('SK_OFFICIAL', 'SUPER_ADMIN')
        THEN 'ADMIN_STAFF'
        ELSE account."segment"
      END AS "metric_segment"
    FROM "public"."system_users_admin_mv" AS account
  )
`;

export function getPlatformAccountMetricSegment(metric: PlatformAccountMetricKey) {
  return metric === "all" ? null : METRIC_SEGMENTS[metric];
}

export function isPlatformAccountMetricKey(
  value: string | undefined,
): value is PlatformAccountMetricKey {
  return value === "all" ||
    value === "verified" ||
    value === "pending" ||
    value === "adminStaff" ||
    value === "archived";
}

export async function getPlatformAccountMetrics(): Promise<PlatformAccountMetrics> {
  const groupedCounts = await prisma.$queryRaw<SegmentCount[]>(Prisma.sql`
    ${CATEGORIZED_USERS_CTE}
    SELECT "metric_segment" AS "segment", COUNT(*) AS "count"
    FROM categorized_users
    GROUP BY "metric_segment"
  `);
  const counts = new Map(groupedCounts.map(({ segment, count }) => [segment, Number(count)]));

  return {
    totalAccounts: groupedCounts.reduce((total, row) => total + Number(row.count), 0),
    activeKkYouthAndGrantees: counts.get(METRIC_SEGMENTS.verified) ?? 0,
    unprofiledOrPending: counts.get(METRIC_SEGMENTS.pending) ?? 0,
    adminStaff: counts.get(METRIC_SEGMENTS.adminStaff) ?? 0,
    archivedOrInactive: counts.get(METRIC_SEGMENTS.archived) ?? 0,
  };
}

export async function getPlatformAccountUsersPage({
  metric,
  role,
  query,
  page,
  pageSize,
}: {
  metric: PlatformAccountMetricKey;
  role: Role | null;
  query: string;
  page: number;
  pageSize: number;
}) {
  const filters: Prisma.Sql[] = [];
  const segment = getPlatformAccountMetricSegment(metric);
  if (segment) filters.push(Prisma.sql`"metric_segment" = ${segment}`);
  if (role) filters.push(Prisma.sql`"role" = ${role}`);

  const normalizedQuery = query.trim().slice(0, 100);
  if (normalizedQuery) {
    filters.push(Prisma.sql`(
      POSITION(LOWER(${normalizedQuery}) IN LOWER("full_name")) > 0
      OR POSITION(LOWER(${normalizedQuery}) IN LOWER("email")) > 0
    )`);
  }
  const whereClause = filters.length
    ? Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}`
    : Prisma.empty;
  const offset = (page - 1) * pageSize;

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<PlatformAccountUserRow[]>(Prisma.sql`
      ${CATEGORIZED_USERS_CTE}
      SELECT
        "user_id" AS "id",
        "full_name" AS "fullName",
        "display_name" AS "displayName",
        "email",
        "avatar_url" AS "avatarUrl",
        "role",
        "is_active" AS "isActive",
        "created_at" AS "createdAt",
        "updated_at" AS "updatedAt",
        "username",
        "phone_number" AS "phoneNumber",
        "barangay",
        "language_pref"::TEXT AS "languagePref",
        "skeap_status" AS "skeapStatus",
        "skeap_application_status" AS "skeapApplicationStatus",
        "grantee_status" AS "granteeStatus",
        "grantee_school" AS "granteeSchool",
        "grantee_year_level" AS "granteeYearLevel",
        "grantee_general_average" AS "granteeGeneralAverage",
        "grantee_date_enrolled" AS "granteeDateEnrolled",
        "grantee_archived_at" AS "granteeArchivedAt",
        "grantee_retention_expires_at" AS "granteeRetentionExpiresAt"
      FROM categorized_users
      ${whereClause}
      ORDER BY "created_at" DESC, "user_id" DESC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `),
    prisma.$queryRaw<UserCount[]>(Prisma.sql`
      ${CATEGORIZED_USERS_CTE}
      SELECT COUNT(*) AS "count"
      FROM categorized_users
      ${whereClause}
    `),
  ]);

  return {
    rows,
    totalCount: Number(countRows[0]?.count ?? BigInt(0)),
  };
}
