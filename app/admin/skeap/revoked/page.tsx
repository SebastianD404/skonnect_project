import { GranteeStatus, Prisma, Role, SubmissionStatus } from "@prisma/client";
import { formatDisplayName } from "@/lib/display-name";
import { requireRole } from "@/lib/auth";
import { normalizeAdminTablePageSize } from "@/lib/admin-pagination";
import { prisma } from "@/lib/prisma";
import RevokedGranteesTable from "./RevokedGranteesTable";

export default async function RevokedGranteesPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string | string[];
    pageSize?: string | string[];
    q?: string | string[];
  }>;
}) {
  await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);

  const resolved = await searchParams;
  const getParam = (value?: string | string[]) => Array.isArray(value) ? value[0] : value;
  const requestedPage = Number(getParam(resolved.page) || 1);
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
  const pageSize = normalizeAdminTablePageSize(Number(getParam(resolved.pageSize)));
  const query = String(getParam(resolved.q) || "").trim();
  const containsQuery = { contains: query, mode: "insensitive" as const };

  const where: Prisma.GranteeWhereInput = {
    status: { in: [GranteeStatus.REMOVED, GranteeStatus.REVOKED] },
    dateRemoved: { not: null },
    ...(query
      ? {
          OR: [
            { user: { is: { fullName: containsQuery } } },
            { user: { is: { email: containsQuery } } },
            {
              user: {
                is: {
                  kkProfile: {
                    is: {
                      firstName: containsQuery,
                      middleName: containsQuery,
                      lastName: containsQuery,
                      purok: containsQuery,
                    },
                  },
                },
              },
            },
            { revocationReason: containsQuery },
            { revocationNotes: containsQuery },
            { remarks: containsQuery },
            {
              submissions: {
                some: {
                  status: SubmissionStatus.REMOVED,
                  reviewNotes: containsQuery,
                },
              },
            },
          ],
        }
      : {}),
  };
  const totalCount = await prisma.grantee.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(page, totalPages);
  const grantees = totalCount > 0
    ? await prisma.grantee.findMany({
        where,
        orderBy: [{ dateRemoved: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
        skip: (currentPage - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          dateRemoved: true,
          revocationReason: true,
          revocationNotes: true,
          remarks: true,
          user: {
            select: {
              fullName: true,
              email: true,
              kkProfile: {
                select: {
                  firstName: true,
                  middleName: true,
                  lastName: true,
                  purok: true,
                },
              },
            },
          },
          submissions: {
            where: { status: SubmissionStatus.REMOVED },
            orderBy: { reviewedAt: "desc" },
            take: 1,
            select: { reviewNotes: true },
          },
        },
      })
    : [];
  const records = grantees.flatMap((grantee) => grantee.dateRemoved
    ? [{
        id: grantee.id,
        fullName: formatDisplayName(grantee.user.kkProfile, grantee.user.fullName),
        email: grantee.user.email,
        sitio: grantee.user.kkProfile?.purok ?? null,
        dateRevoked: grantee.dateRemoved,
        reason: grantee.revocationReason?.trim()
          ? [
              grantee.revocationReason.trim(),
              grantee.revocationNotes?.trim()
                ? `Additional Notes: ${grantee.revocationNotes.trim()}`
                : null,
            ].filter(Boolean).join("\n")
          : grantee.remarks?.trim() || grantee.submissions[0]?.reviewNotes?.trim() || null,
      }]
    : []);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-12">
      <header>
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          SKEAP Management
        </span>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
          Revoked Grantees
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">
          Review scholarships revoked from active grantees or during submission review. Graduated scholars are listed separately.
        </p>
      </header>

      <section className="flex w-full flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <RevokedGranteesTable
          records={records}
          query={query}
          page={currentPage}
          pageSize={pageSize}
          totalCount={totalCount}
        />
      </section>
    </div>
  );
}
