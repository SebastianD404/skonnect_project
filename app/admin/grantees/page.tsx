import { hasGranteeRetentionColumn, prisma } from "@/lib/prisma";
import { getRetentionExpiryDate } from "@/lib/grantee-retention";
import { formatDisplayName } from "@/lib/display-name";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminGranteesPageClient from "../AdminGranteesPageClient";
import type { GranteeTableRow } from "../grantees/GranteeStatusTable";
import { ensureProfile } from "@/lib/auth";
import { normalizeSkeapSchoolName } from "@/lib/skeap-school";
import { getAcademicJourneyProgress } from "@/lib/academic-journey";
import { normalizeAdminTablePageSize } from "@/lib/admin-pagination";

export default async function AdminGranteesPage({ searchParams }: {
  searchParams: Promise<{ page?: string | string[]; pageSize?: string | string[]; q?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const rawPage = Array.isArray(resolvedSearchParams.page) ? resolvedSearchParams.page[0] : resolvedSearchParams.page;
  const rawPageSize = Array.isArray(resolvedSearchParams.pageSize) ? resolvedSearchParams.pageSize[0] : resolvedSearchParams.pageSize;
  const rawQuery = Array.isArray(resolvedSearchParams.q) ? resolvedSearchParams.q[0] : resolvedSearchParams.q;
  const query = String(rawQuery || "").trim();
  const requestedPage = Number(rawPage || 1);
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
  const requestedPageSize = Number(rawPageSize);
  const pageSize = normalizeAdminTablePageSize(requestedPageSize);
  const skip = (page - 1) * pageSize;
  const hasRetentionColumn = await hasGranteeRetentionColumn();
  const profileStatusSql = `AND profile_user."role"::text = 'GRANTEE' AND (
       g."status"::text = 'ACTIVE'
     )
     AND EXISTS (
       SELECT 1
       FROM "skeap_applications" approved_application
       WHERE approved_application."userId" = profile_user."id"
         AND approved_application."status" = 'APPROVED'
     )`;
  const pageKeys = await prisma.$queryRawUnsafe<Array<{
    recordId: string;
  }>>(
    `SELECT g."id"::text AS "recordId", g."updatedAt" AS "updatedAt"
     FROM "grantees" g
     JOIN "users" profile_user ON profile_user."id" = g."userId"
     LEFT JOIN "kk_profiles" kk_profile ON kk_profile."id" = profile_user."kkProfileId"
     WHERE TRUE ${profileStatusSql}
       AND (
         $3 = ''
         OR concat_ws(
           ' ',
           profile_user."fullName",
           profile_user."email",
           profile_user."phoneNumber",
           kk_profile."fullName",
           kk_profile."firstName",
           kk_profile."middleName",
           kk_profile."lastName",
           kk_profile."contactNumber",
           g."school",
           g."yearLevel"
         ) ILIKE '%' || $3 || '%'
         OR EXISTS (
           SELECT 1
           FROM "skeap_applications" search_application
           WHERE search_application."userId" = profile_user."id"
             AND search_application."contactNumber" ILIKE '%' || $3 || '%'
         )
       )
     ORDER BY "updatedAt" DESC, "recordId" ASC
     LIMIT $1 OFFSET $2`,
    pageSize,
    skip,
    query
  );
  const totalCountRows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*)::bigint AS "count" FROM (
       SELECT g."id"
       FROM "grantees" g
       JOIN "users" profile_user ON profile_user."id" = g."userId"
       LEFT JOIN "kk_profiles" kk_profile ON kk_profile."id" = profile_user."kkProfileId"
       WHERE TRUE ${profileStatusSql}
         AND (
           $1 = ''
           OR concat_ws(
             ' ',
             profile_user."fullName",
             profile_user."email",
             profile_user."phoneNumber",
             kk_profile."fullName",
             kk_profile."firstName",
             kk_profile."middleName",
             kk_profile."lastName",
             kk_profile."contactNumber",
             g."school",
             g."yearLevel"
           ) ILIKE '%' || $1 || '%'
           OR EXISTS (
             SELECT 1
             FROM "skeap_applications" search_application
             WHERE search_application."userId" = profile_user."id"
               AND search_application."contactNumber" ILIKE '%' || $1 || '%'
           )
         )
     ) matching_grantees`,
    query
  );
  const grantees = await prisma.grantee.findMany({
      where: { id: { in: pageKeys.map((item) => item.recordId) } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        status: true,
        yearLevel: true,
        school: true,
        dateEnrolled: true,
        graduatedAt: true,
        ...(hasRetentionColumn ? { retentionExpiresAt: true } : {}),
        createdAt: true,
        updatedAt: true,
        submissions: {
          orderBy: { submittedAt: "desc" },
          select: {
            semester: true,
            status: true,
          },
        },
        user: {
          select: {
            fullName: true,
            email: true,
            phoneNumber: true,
            kkProfile: {
              select: {
                firstName: true,
                middleName: true,
                lastName: true,
              },
            },
            skeapApplications: {
              orderBy: { submittedAt: "desc" },
              take: 1,
              select: { contactNumber: true },
            },
            avatarUrl: true,
          },
        },
      },
    });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const appUser = await ensureProfile(user);

  if (!appUser) {
    redirect("/login");
  }

  const granteeRows: GranteeTableRow[] = grantees.map((grantee) => {
    const journeyProgress = getAcademicJourneyProgress(grantee.submissions, grantee.dateEnrolled);
    return {
      id: grantee.id,
      fullName: formatDisplayName(grantee.user.kkProfile, grantee.user.fullName),
      email: grantee.user.email,
      contactNumber:
        grantee.user.phoneNumber?.trim() ||
        grantee.user.skeapApplications[0]?.contactNumber?.trim() ||
        null,
      school: normalizeSkeapSchoolName(grantee.school),
      yearLevel: grantee.yearLevel,
      currentJourneySemesterIndex: journeyProgress.currentSemesterIndex,
      validatedJourneySemesterIndexes: journeyProgress.validatedSemesterIndexes,
      status: "ACTIVE",
      dateEnrolled: grantee.dateEnrolled.toISOString(),
      graduatedAt: grantee.graduatedAt?.toISOString() ?? null,
      retentionExpiresAt: getRetentionExpiryDate(grantee)?.toISOString() ?? null,
      updatedAt: grantee.updatedAt.toISOString(),
      detailsHref: `/admin/grantees/${grantee.id}`,
    };
  });

  const granteeRowsById = new Map(granteeRows.map((grantee) => [grantee.id, grantee]));
  const paginatedGranteeRows = pageKeys.flatMap((item) => {
    const grantee = granteeRowsById.get(item.recordId);
    return grantee ? [grantee] : [];
  });
  const totalCount = Number(totalCountRows[0]?.count ?? 0);
  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 sm:gap-8">
      <AdminGranteesPageClient
        grantees={paginatedGranteeRows}
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
        query={query}
      />
    </div>
  );
}
