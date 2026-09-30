import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { hasGranteeRetentionColumn, prisma } from "@/lib/prisma";
import { getRetentionExpiryDate } from "@/lib/grantee-retention";
import { exportToExcel } from "@/lib/utils/export";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUser = await ensureProfile(user);
  if (!appUser || (appUser.role !== "SK_OFFICIAL" && appUser.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requestedStatus = request.nextUrl.searchParams.get("status")?.toUpperCase() ?? "ALL";
  const statusFilter = ["ACTIVE", "GRADUATED", "REMOVED"].includes(requestedStatus)
    ? requestedStatus
    : "ALL";
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const profileStatusSql = statusFilter === "ALL"
    ? ""
    : statusFilter === "ACTIVE"
    ? `AND g."status"::text IN ('ACTIVE', 'PROBATIONARY')`
    : `AND g."status"::text = '${statusFilter}'`;
  const fallbackStatusSql = statusFilter === "ALL" || statusFilter === "ACTIVE" ? "" : "AND FALSE";
  const hasRetentionColumn = await hasGranteeRetentionColumn();
  const pageKeys = await prisma.$queryRawUnsafe<Array<{
    source: "profile" | "fallback";
    recordId: string;
    userId: string;
  }>>(
    `SELECT 'profile'::text AS "source", g."id"::text AS "recordId", g."userId"::text AS "userId", g."updatedAt" AS "updatedAt"
     FROM "grantees" g
     JOIN "users" profile_user ON profile_user."id" = g."userId"
     WHERE TRUE ${profileStatusSql}
       AND ($1 = '' OR concat_ws(' ', profile_user."fullName", profile_user."email", g."school", g."yearLevel") ILIKE '%' || $1 || '%')
     UNION ALL
     SELECT 'fallback'::text AS "source", ('user-' || u."id")::text AS "recordId", u."id"::text AS "userId", u."updatedAt" AS "updatedAt"
     FROM "users" u
     WHERE u."role"::text = 'GRANTEE'
       AND NOT EXISTS (SELECT 1 FROM "grantees" g WHERE g."userId" = u."id")
       ${fallbackStatusSql}
       AND ($1 = '' OR concat_ws(' ', u."fullName", u."email") ILIKE '%' || $1 || '%')
     ORDER BY "updatedAt" DESC, "recordId" ASC`,
    query
  );
  const [grantees, fallbackUsers] = await Promise.all([
    prisma.grantee.findMany({
      where: { id: { in: pageKeys.filter((item) => item.source === "profile").map((item) => item.recordId) } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        status: true,
        school: true,
        yearLevel: true,
        generalAverage: true,
        dateEnrolled: true,
        graduatedAt: true,
        ...(hasRetentionColumn ? { retentionExpiresAt: true } : {}),
        user: { select: { fullName: true, email: true, phoneNumber: true } },
      },
    }),
    prisma.user.findMany({
      where: { id: { in: pageKeys.filter((item) => item.source === "fallback").map((item) => item.userId) } },
      select: { id: true, fullName: true, email: true, phoneNumber: true, createdAt: true },
    }),
  ]);
  const profileRows = grantees.map((grantee) => ({
    fullName: grantee.user.fullName,
    email: grantee.user.email,
    contactNumber: grantee.user.phoneNumber,
    school: grantee.school,
    yearLevel: grantee.yearLevel,
    status: grantee.status === "ACTIVE" || grantee.status === "PROBATIONARY" ? "Active" : grantee.status,
    generalAverage: grantee.generalAverage,
    dateEnrolled: grantee.dateEnrolled,
    graduatedAt: grantee.graduatedAt,
    retentionExpiresAt: getRetentionExpiryDate(grantee),
  }));
  const fallbackRows = fallbackUsers.map((user) => ({
    fullName: user.fullName,
    email: user.email,
    contactNumber: user.phoneNumber,
    school: "No school provided",
    yearLevel: "No year level provided",
    status: "Active",
    generalAverage: null,
    dateEnrolled: user.createdAt,
    graduatedAt: null,
    retentionExpiresAt: null,
  }));
  const profilesById = new Map(grantees.map((grantee, index) => [grantee.id, profileRows[index]]));
  const fallbacksById = new Map(fallbackUsers.map((user, index) => [`user-${user.id}`, fallbackRows[index]]));
  const exportRows = pageKeys.flatMap((item) => {
    const row = item.source === "profile" ? profilesById.get(item.recordId) : fallbacksById.get(item.recordId);
    return row ? [row] : [];
  });
  const file = exportToExcel(exportRows, "grantee-records", "grantees");

  return new NextResponse(file.body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
