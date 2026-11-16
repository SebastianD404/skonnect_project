import { hasGranteeRetentionColumn, prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getRetentionExpiryDate } from "@/lib/grantee-retention";
import { formatDisplayName } from "@/lib/display-name";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import UserRoleManager from "../UserRoleManager";
import AdminTablePaginationFooter from "@/app/admin/AdminTablePaginationFooter";
import { normalizeAdminTablePageSize } from "@/lib/admin-pagination";

export default async function SystemAdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; pageSize?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const rawPage = Array.isArray(resolvedSearchParams.page) ? resolvedSearchParams.page[0] : resolvedSearchParams.page;
  const rawPageSize = Array.isArray(resolvedSearchParams.pageSize)
    ? resolvedSearchParams.pageSize[0]
    : resolvedSearchParams.pageSize;
  const requestedPage = Number(rawPage || 1);
  const page = Number.isSafeInteger(requestedPage) ? Math.max(1, requestedPage) : 1;
  const requestedPageSize = Number(rawPageSize);
  const pageSize = normalizeAdminTablePageSize(requestedPageSize);
  const hasRetentionColumn = await hasGranteeRetentionColumn();
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
  const [totalCount, users, currentUser] = await Promise.all([
    prisma.user.count(),
    prisma.user.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        fullName: true,
        kkProfile: {
          select: {
            firstName: true,
            middleName: true,
            lastName: true,
          },
        },
        email: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        username: true,
        phoneNumber: true,
        barangay: true,
        languagePref: true,
        skeapApplications: {
          orderBy: [{ updatedAt: "desc" }, { submittedAt: "desc" }],
          take: 1,
          select: { status: true },
        },
        grantee: {
          select: {
            status: true,
            school: true,
            yearLevel: true,
            generalAverage: true,
            dateEnrolled: true,
            dateRemoved: true,
            graduatedAt: true,
            ...(hasRetentionColumn ? { retentionExpiresAt: true } : {}),
          },
        },
      },
    }),
    currentUserPromise,
  ]);

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 sm:gap-8">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <span>System Admin</span>
        <span>/</span>
        <span className="text-slate-900">Users</span>
      </div>

      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">System Admin</p>
          <h1 className="text-4xl font-black text-slate-950 sm:text-5xl">Users &amp; Roles</h1>
          <p className="max-w-2xl text-sm text-slate-600">
            Grant or revoke SK Admin workspace access for Barangay Pico SK Officials. Youth and Grantee statuses are assigned automatically through KK Profiling and SKEAP workflows.
          </p>
        </div>
        <Link
          href="/system-admin/reconcile"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reconcile Auth Users
        </Link>
      </header>

      <UserRoleManager
        totalCount={totalCount}
        users={users.map((user) => ({
          id: user.id,
          fullName: user.fullName,
          displayName: formatDisplayName(user.kkProfile, user.fullName),
          email: user.email,
          avatarUrl: user.avatarUrl,
          role: user.role,
          isActive: user.isActive,
          granteeStatus: user.grantee?.status ?? null,
          username: user.username,
          phoneNumber: user.phoneNumber,
          barangay: user.barangay,
          languagePref: user.languagePref,
          skeapStatus: user.skeapApplications[0]?.status ?? null,
          updatedAt: user.updatedAt.toISOString(),
          granteeSchool: user.grantee?.school ?? null,
          granteeYearLevel: user.grantee?.yearLevel ?? null,
          granteeGeneralAverage: user.grantee?.generalAverage ?? null,
          granteeDateEnrolled: user.grantee?.dateEnrolled.toISOString() ?? null,
          granteeArchivedAt: (user.grantee?.graduatedAt ?? user.grantee?.dateRemoved)?.toISOString() ?? null,
          granteeRetentionExpiresAt: user.grantee
            ? getRetentionExpiryDate(user.grantee)?.toISOString() ?? null
            : null,
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
