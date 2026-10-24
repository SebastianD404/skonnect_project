import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import UserRoleManager from "../UserRoleManager";
import AdminTablePaginationFooter from "@/app/admin/AdminTablePaginationFooter";

const PAGE_SIZES = [10, 20, 50] as const;

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
  const pageSize = PAGE_SIZES.includes(requestedPageSize as (typeof PAGE_SIZES)[number])
    ? requestedPageSize
    : 10;
  const [totalCount, users] = await Promise.all([
    prisma.user.count(),
    prisma.user.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        fullName: true,
        email: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
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
            Manage account access, assign RBAC roles, and control active user permissions.
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
          email: user.email,
          avatarUrl: user.avatarUrl,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt.toISOString(),
        }))}
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
