import { hasGranteeRetentionColumn, prisma } from "@/lib/prisma";
import { getRetentionExpiryDate } from "@/lib/grantee-retention";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminGranteesPageClient from "../AdminGranteesPageClient";
import type { GranteeTableRow } from "../grantees/GranteeStatusTable";
import { ensureProfile } from "@/lib/auth";
import {
  GRANTEE_PLACEHOLDER_SCHOOL,
  GRANTEE_PLACEHOLDER_YEAR_LEVEL,
} from "@/lib/grantee-profile";

const PAGE_SIZES = [10, 20, 50] as const;

export default async function AdminGranteesPage({ searchParams }: {
  searchParams: Promise<{ page?: string | string[]; pageSize?: string | string[]; status?: string | string[]; q?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const rawPage = Array.isArray(resolvedSearchParams.page) ? resolvedSearchParams.page[0] : resolvedSearchParams.page;
  const rawPageSize = Array.isArray(resolvedSearchParams.pageSize) ? resolvedSearchParams.pageSize[0] : resolvedSearchParams.pageSize;
  const rawStatus = Array.isArray(resolvedSearchParams.status) ? resolvedSearchParams.status[0] : resolvedSearchParams.status;
  const rawQuery = Array.isArray(resolvedSearchParams.q) ? resolvedSearchParams.q[0] : resolvedSearchParams.q;
  const query = String(rawQuery || "").trim();
  const requestedPage = Number(rawPage || 1);
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
  const requestedPageSize = Number(rawPageSize);
  const pageSize = PAGE_SIZES.includes(requestedPageSize as (typeof PAGE_SIZES)[number])
    ? requestedPageSize
    : 10;
  const requestedStatus = String(rawStatus || "").toUpperCase();
  const statusFilter = ["ACTIVE", "GRADUATED", "REMOVED"].includes(requestedStatus)
    ? requestedStatus
    : "ALL";
  const skip = (page - 1) * pageSize;
  const hasRetentionColumn = await hasGranteeRetentionColumn();
  const profileStatusSql = statusFilter === "ALL"
    ? ""
    : statusFilter === "ACTIVE"
    ? `AND g."status"::text IN ('ACTIVE', 'PROBATIONARY')`
    : `AND g."status"::text = '${statusFilter}'`;
  const fallbackStatusSql = statusFilter === "ALL" || statusFilter === "ACTIVE" ? "" : "AND FALSE";
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
       AND NOT EXISTS (SELECT 1 FROM "grantees" g WHERE g."userId" = u."id")
       ${fallbackStatusSql}
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
         AND NOT EXISTS (SELECT 1 FROM "grantees" g WHERE g."userId" = u."id")
         ${fallbackStatusSql}
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
        generalAverage: true,
        dateEnrolled: true,
        graduatedAt: true,
        ...(hasRetentionColumn ? { retentionExpiresAt: true } : {}),
        createdAt: true,
        updatedAt: true,
        submissions: {
          orderBy: { submittedAt: "desc" },
          where: { generalAverage: { not: null } },
          take: 1,
          select: {
            generalAverage: true,
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
            role: true,
            inquiries: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                id: true,
                application: {
                  select: {
                    id: true,
                    currentCourse: true,
                    yearLevel: true,
                    gwa: true,
                    applicantName: true,
                    permanentAddress: true,
                    dateOfBirth: true,
                    placeOfBirth: true,
                    age: true,
                    civilStatus: true,
                    gender: true,
                    fathersName: true,
                    fathersOccupation: true,
                    fathersContact: true,
                    mothersMaidenName: true,
                    mothersOccupation: true,
                    mothersContact: true,
                    contactNumber: true,
                    emailAddress: true,
                    photoFileUrl: true,
                    uploadedFiles: true,
                  },
                },
              },
            },
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
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  const granteeRows: GranteeTableRow[] = grantees.map((grantee) => {
    const latestInquiry = grantee.user.inquiries?.[0] ?? null;
    const latestSubmission = grantee.submissions?.[0] ?? null;
    const application = latestInquiry?.application
      ? {
          currentCourse: latestInquiry.application.currentCourse ?? undefined,
          yearLevel: latestInquiry.application.yearLevel ?? undefined,
          gwa: latestInquiry.application.gwa ?? null,
          applicantName: latestInquiry.application.applicantName ?? undefined,
          permanentAddress: latestInquiry.application.permanentAddress ?? undefined,
          dateOfBirth: latestInquiry.application.dateOfBirth?.toISOString() ?? undefined,
          placeOfBirth: latestInquiry.application.placeOfBirth ?? undefined,
          age: latestInquiry.application.age ?? undefined,
          civilStatus: latestInquiry.application.civilStatus ?? undefined,
          gender: latestInquiry.application.gender ?? undefined,
          fathersName: latestInquiry.application.fathersName ?? undefined,
          fathersOccupation: latestInquiry.application.fathersOccupation ?? undefined,
          fathersContact: latestInquiry.application.fathersContact ?? undefined,
          mothersMaidenName: latestInquiry.application.mothersMaidenName ?? undefined,
          mothersOccupation: latestInquiry.application.mothersOccupation ?? undefined,
          mothersContact: latestInquiry.application.mothersContact ?? undefined,
          contactNumber: latestInquiry.application.contactNumber ?? undefined,
          emailAddress: latestInquiry.application.emailAddress ?? grantee.user.email ?? undefined,
          photoFileUrl: latestInquiry.application.photoFileUrl ?? undefined,
          uploadedFiles: latestInquiry.application.uploadedFiles ?? undefined,
        }
      : null;

    return {
      id: grantee.id,
      fullName: grantee.user.fullName,
      email: grantee.user.email,
      school: grantee.school,
      yearLevel: grantee.yearLevel,
      status: grantee.status,
      generalAverage:
        latestSubmission?.generalAverage ?? latestInquiry?.application?.gwa ?? grantee.generalAverage,
      dateEnrolled: grantee.dateEnrolled.toISOString(),
      graduatedAt: grantee.graduatedAt?.toISOString() ?? null,
      retentionExpiresAt: getRetentionExpiryDate(grantee)?.toISOString() ?? null,
      updatedAt: grantee.updatedAt.toISOString(),
      detailsHref: `/admin/grantees/${grantee.id}`,
      application,
      applicationDownloadHref: latestInquiry?.application
        ? `/api/admin/skeap-applications/${latestInquiry.application.id}/download`
        : undefined,
    };
  });

  const fallbackRows: GranteeTableRow[] = granteeUsersWithoutProfile.map((user) => ({
    id: `user-${user.id}`,
    fullName: user.fullName,
    email: user.email,
    school: GRANTEE_PLACEHOLDER_SCHOOL,
    yearLevel: GRANTEE_PLACEHOLDER_YEAR_LEVEL,
    status: "PROBATIONARY",
    generalAverage: null,
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
    <AdminGranteesPageClient
      grantees={paginatedGranteeRows}
      page={page}
      pageSize={pageSize}
      totalCount={totalCount}
    />
  );
}
