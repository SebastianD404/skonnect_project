import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { getRetentionExpiryDate } from "@/lib/grantee-retention";
import UserRoleManager from "../UserRoleManager";
import AdminTablePaginationFooter from "@/app/admin/AdminTablePaginationFooter";
import { normalizeAdminTablePageSize } from "@/lib/admin-pagination";
import {
  getPlatformAccountMetrics,
  getPlatformAccountUsersPage,
  isPlatformAccountMetricKey,
} from "@/lib/platform-metrics";

const ROLE_FILTERS: Role[] = ["YOUTH", "GRANTEE", "SK_OFFICIAL", "SUPER_ADMIN"];

function isRoleFilter(value: string | undefined): value is Role {
  return ROLE_FILTERS.includes(value as Role);
}

export default async function SystemAdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string | string[];
    pageSize?: string | string[];
    metric?: string | string[];
    role?: string | string[];
    q?: string | string[];
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const rawPage = Array.isArray(resolvedSearchParams.page) ? resolvedSearchParams.page[0] : resolvedSearchParams.page;
  const rawPageSize = Array.isArray(resolvedSearchParams.pageSize)
    ? resolvedSearchParams.pageSize[0]
    : resolvedSearchParams.pageSize;
  const rawMetric = Array.isArray(resolvedSearchParams.metric)
    ? resolvedSearchParams.metric[0]
    : resolvedSearchParams.metric;
  const rawRole = Array.isArray(resolvedSearchParams.role)
    ? resolvedSearchParams.role[0]
    : resolvedSearchParams.role;
  const rawQuery = Array.isArray(resolvedSearchParams.q)
    ? resolvedSearchParams.q[0]
    : resolvedSearchParams.q;
  const selectedRole = isRoleFilter(rawRole) ? rawRole : "ALL";
  const selectedMetric = selectedRole !== "ALL"
    ? "all"
    : isPlatformAccountMetricKey(rawMetric)
      ? rawMetric
      : "all";
  const searchQuery = rawQuery?.trim().slice(0, 100) ?? "";
  const requestedPage = Number(rawPage || 1);
  const page = Number.isSafeInteger(requestedPage) ? Math.max(1, requestedPage) : 1;
  const requestedPageSize = Number(rawPageSize);
  const pageSize = normalizeAdminTablePageSize(requestedPageSize);
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const currentUserPromise = authUser
    ? prisma.user.findUnique({
        where: { authId: authUser.id },
        select: { id: true },
      })
    : Promise.resolve(null);
  const [metrics, usersPage, currentUser] = await Promise.all([
    getPlatformAccountMetrics(),
    getPlatformAccountUsersPage({
      metric: selectedMetric,
      role: selectedRole === "ALL" ? null : selectedRole,
      query: searchQuery,
      page,
      pageSize,
    }),
    currentUserPromise,
  ]);
  const totalCount = usersPage.totalCount;

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 sm:gap-8">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <span>System Admin</span>
        <span>/</span>
        <span className="text-slate-900">Users</span>
      </div>

      <header>
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">System Admin</p>
          <h1 className="text-4xl font-black text-slate-950 sm:text-5xl">Users &amp; Roles</h1>
          <p className="max-w-2xl text-sm text-slate-600">
            Grant or revoke SK Admin workspace access for Barangay Pico SK Officials. Youth and Grantee statuses are assigned automatically through KK Profiling and SKEAP workflows.
          </p>
        </div>
      </header>

      <UserRoleManager
        metrics={metrics}
        selectedMetric={selectedMetric}
        selectedRole={selectedRole}
        searchQuery={searchQuery}
        totalCount={totalCount}
        users={usersPage.rows.map((user) => ({
          id: user.id,
          fullName: user.fullName,
          displayName: user.displayName,
          email: user.email,
          avatarUrl: user.avatarUrl,
          role: user.role,
          isActive: user.isActive,
          granteeStatus: user.granteeStatus,
          skeapApplicationStatus: user.skeapApplicationStatus,
          skeapStatus: user.skeapStatus,
          username: user.username,
          phoneNumber: user.phoneNumber,
          barangay: user.barangay,
          languagePref: user.languagePref,
          updatedAt: user.updatedAt.toISOString(),
          granteeSchool: user.granteeSchool,
          granteeYearLevel: user.granteeYearLevel,
          granteeGeneralAverage: user.granteeGeneralAverage,
          granteeDateEnrolled: user.granteeDateEnrolled?.toISOString() ?? null,
          granteeArchivedAt: user.granteeArchivedAt?.toISOString() ?? null,
          granteeRetentionExpiresAt: getRetentionExpiryDate({
            retentionExpiresAt: user.granteeRetentionExpiresAt,
            graduatedAt: user.granteeArchivedAt,
            dateRemoved: user.granteeArchivedAt,
          })?.toISOString() ?? null,
          createdAt: user.createdAt.toISOString(),
        }))}
        currentUserId={currentUser?.id ?? null}
      />
      <AdminTablePaginationFooter
        totalCount={totalCount}
        page={page}
        pageSize={pageSize}
        basePath="/system-admin/users"
      />
    </div>
  );
}
