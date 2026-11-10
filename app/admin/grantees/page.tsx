import { hasGranteeRetentionColumn, prisma } from "@/lib/prisma";
import { getRetentionExpiryDate } from "@/lib/grantee-retention";
import { formatDisplayName } from "@/lib/display-name";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminGranteesPageClient from "../AdminGranteesPageClient";
import type { GranteeTableRow } from "../grantees/GranteeStatusTable";
import { ensureProfile } from "@/lib/auth";
import {
  GRANTEE_PLACEHOLDER_SCHOOL,
  GRANTEE_PLACEHOLDER_YEAR_LEVEL,
} from "@/lib/grantee-profile";
import { normalizeSkeapSchoolName } from "@/lib/skeap-school";
import { getAcademicJourneyProgress } from "@/lib/academic-journey";

const PAGE_SIZES = [10, 20, 50] as const;

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
  const pageSize = PAGE_SIZES.includes(requestedPageSize as (typeof PAGE_SIZES)[number])
    ? requestedPageSize
    : 10;
  const skip = (page - 1) * pageSize;
  const hasRetentionColumn = await hasGranteeRetentionColumn();
  const profileStatusSql = `AND profile_user."role"::text = 'GRANTEE' AND (
       g."status"::text IN ('ACTIVE', 'PROBATIONARY')
     )
     AND EXISTS (
       SELECT 1
       FROM "skeap_applications" approved_application
       WHERE approved_application."userId" = profile_user."id"
         AND approved_application."status" = 'APPROVED'
     )`;
  const pageKeys = await prisma.$queryRawUnsafe<Array<{
    source: "profile" | "fallback";
    recordId: string;
    userId: string;
  }>>(
    `SELECT 'profile'::text AS "source", g."id"::text AS "recordId", g."userId"::text AS "userId", g."updatedAt" AS "updatedAt"
     FROM "grantees" g
     JOIN "users" profile_user ON profile_user."id" = g."userId"
     WHERE TRUE ${profileStatusSql}
       AND ($3 = '' OR concat_ws(' ', profile_user."fullName", profile_user."email", g."school", g."yearLevel") ILIKE '%' || $3 || '%')
     UNION ALL
     SELECT 'fallback'::text AS "source", ('user-' || u."id")::text AS "recordId", u."id"::text AS "userId", u."updatedAt" AS "updatedAt"
     FROM "users" u
     WHERE u."role"::text = 'GRANTEE'
       AND EXISTS (
         SELECT 1
         FROM "skeap_applications" approved_application
         WHERE approved_application."userId" = u."id"
           AND approved_application."status" = 'APPROVED'
       )
       AND NOT EXISTS (SELECT 1 FROM "grantees" g WHERE g."userId" = u."id")
       AND ($3 = '' OR concat_ws(' ', u."fullName", u."email") ILIKE '%' || $3 || '%')
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
       WHERE TRUE ${profileStatusSql}
         AND ($1 = '' OR concat_ws(' ', profile_user."fullName", profile_user."email", g."school", g."yearLevel") ILIKE '%' || $1 || '%')
       UNION ALL
       SELECT u."id"
       FROM "users" u
       WHERE u."role"::text = 'GRANTEE'
         AND EXISTS (
           SELECT 1
           FROM "skeap_applications" approved_application
           WHERE approved_application."userId" = u."id"
             AND approved_application."status" = 'APPROVED'
         )
         AND NOT EXISTS (SELECT 1 FROM "grantees" g WHERE g."userId" = u."id")
         AND ($1 = '' OR concat_ws(' ', u."fullName", u."email") ILIKE '%' || $1 || '%')
     ) matching_grantees`,
    query
  );
  const grantees = await prisma.grantee.findMany({
      where: { id: { in: pageKeys.filter((item) => item.source === "profile").map((item) => item.recordId) } },
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
            id: true,
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
            role: true,
            updatedAt: true,
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

  const granteeUsersWithoutProfile = await prisma.user.findMany({
    where: {
      id: { in: pageKeys.filter((item) => item.source === "fallback").map((item) => item.userId) },
      role: "GRANTEE",
      grantee: {
        is: null,
      },
    },
    select: {
      id: true,
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
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

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
      status:
        grantee.user.role === "GRANTEE" && grantee.status === "REMOVED"
          ? "ACTIVE"
          : grantee.user.role !== "GRANTEE" && grantee.status !== "GRADUATED"
            ? "REMOVED"
            : grantee.status,
      dateEnrolled: grantee.dateEnrolled.toISOString(),
      graduatedAt: grantee.graduatedAt?.toISOString() ?? null,
      retentionExpiresAt: getRetentionExpiryDate(grantee)?.toISOString() ?? null,
      updatedAt: grantee.updatedAt.toISOString(),
      detailsHref: `/admin/grantees/${grantee.id}`,
    };
  });

  const fallbackRows: GranteeTableRow[] = granteeUsersWithoutProfile.map((user) => ({
    id: `user-${user.id}`,
    fullName: formatDisplayName(user.kkProfile, user.fullName),
    email: user.email,
    contactNumber:
      user.phoneNumber?.trim() ||
      user.skeapApplications[0]?.contactNumber?.trim() ||
      null,
    school: GRANTEE_PLACEHOLDER_SCHOOL,
    yearLevel: GRANTEE_PLACEHOLDER_YEAR_LEVEL,
    currentJourneySemesterIndex: 0,
    validatedJourneySemesterIndexes: [],
    status: "PROBATIONARY",
    dateEnrolled: user.createdAt.toISOString(),
    graduatedAt: null,
    retentionExpiresAt: null,
    updatedAt: user.updatedAt.toISOString(),
    detailsHref: `/admin/grantees/user-${user.id}`,
  }));

  const granteeRowsById = new Map(granteeRows.map((grantee) => [grantee.id, grantee]));
  const fallbackRowsById = new Map(fallbackRows.map((grantee) => [grantee.id, grantee]));
  const paginatedGranteeRows = pageKeys.flatMap((item) => {
    const grantee = item.source === "profile"
      ? granteeRowsById.get(item.recordId)
      : fallbackRowsById.get(item.recordId);
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
      />
    </div>
  );
}
