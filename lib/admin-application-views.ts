import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface SkeapAdminQueueRow {
  id: string;
  inquiryId: string | null;
  inquiryCreatedAt: Date | null;
}

export interface SkeapAdminViewCounts {
  pendingCount: number;
  returnedCount: number;
  resubmittedCount: number;
  physicalCtcCount: number;
  withdrawnCount: number;
}

export interface KkProfilingAdminViewRow {
  id: string;
  program: string;
  userId: string | null;
  fullName: string;
  email: string;
  address: string;
  sex: string;
  age: number;
  ageGroup: string | null;
  birthDate: Date;
  facebook: string;
  contactNumber: string;
  civilStatus: string;
  youthClassification: string;
  classification: string;
  youthAgeGroup: string;
  workStatus: string;
  educationalBackground: string;
  registeredSKVoter: string;
  isSkVoter: boolean;
  votedLastSK: string;
  registeredNationalVoter: string;
  attendedKKAssembly: string;
  assemblyTimes: string | null;
  noAssemblyReason: string | null;
  consent: boolean;
  submittedAt: Date;
  reviewStatus: string;
  status: string;
  withdrawnAt: Date | null;
  withdrawalReason: string | null;
  archivedReason: string | null;
  archivedAt: Date | null;
  reviewNotes: string | null;
  idBackFileUrl: string | null;
  birthCertificateFileUrl: string | null;
  idDocumentType: string | null;
  idFrontFileUrl: string | null;
  photoFileUrl: string | null;
  idSingleFileUrl: string | null;
  residencyStatementAcknowledgement: boolean;
  middleName: string;
  requiresManualReview: boolean;
  skeapStatus: string | null;
  granteeId: string | null;
}

export interface KkProfilingAdminViewCounts {
  pendingCount: number;
  returnedCount: number;
  resubmittedCount: number;
  physicalCtcCount: number;
  withdrawnCount: number;
}

export type SkeapAdminQueueFilter = "queue" | "returned" | "withdrawn" | "search";

function getSkeapAdminWhere(
  range: { start: Date; end: Date },
  filter: SkeapAdminQueueFilter,
  search?: string,
  inquiryId?: string,
) {
  const conditions: Prisma.Sql[] = [Prisma.sql`"inquiryId" IS NOT NULL`];
  if (inquiryId) conditions.push(Prisma.sql`"inquiryId" = ${inquiryId}`);

  if (filter !== "search") {
    conditions.push(Prisma.sql`"inquiryCreatedAt" >= ${range.start} AND "inquiryCreatedAt" < ${range.end}`);
  }

  if (filter === "returned") {
    conditions.push(Prisma.sql`
      "reviewStatus" ILIKE ANY (ARRAY['%return%', '%correction%', '%required%', '%revise%', '%revision%'])
      AND "status" NOT IN ('APPROVED', 'REJECTED', 'WITHDRAWN')
      AND COALESCE("reviewStatus", '') NOT ILIKE '%approve%'
      AND COALESCE("reviewStatus", '') NOT ILIKE '%reject%'
      AND COALESCE("reviewStatus", '') NOT ILIKE '%withdraw%'
      AND COALESCE("reviewStatus", '') NOT ILIKE '%cancel%'
    `);
  } else if (filter === "withdrawn") {
    conditions.push(Prisma.sql`
      (
        "status" = 'WITHDRAWN'
        OR COALESCE("reviewStatus", '') ILIKE '%withdraw%'
      )
    `);
  } else if (filter === "search") {
    const term = `%${search?.trim() ?? ""}%`;
    conditions.push(Prisma.sql`
      COALESCE("reviewStatus", '') NOT ILIKE '%cancel%'
      AND (
        "fullName" ILIKE ${term}
        OR "email" ILIKE ${term}
      )
    `);
  } else {
    conditions.push(Prisma.sql`
      (
        "reviewStatus" ILIKE '%pending%'
        OR "reviewStatus" ILIKE '%pre_qual%'
        OR "reviewStatus" ILIKE '%pre-qual%'
        OR "reviewStatus" ILIKE '%resubm%'
        OR "reviewStatus" ILIKE '%respond%'
      )
      AND "status" NOT IN ('APPROVED', 'REJECTED', 'WITHDRAWN')
      AND COALESCE("reviewStatus", '') NOT ILIKE '%approve%'
      AND COALESCE("reviewStatus", '') NOT ILIKE '%reject%'
      AND COALESCE("reviewStatus", '') NOT ILIKE '%withdraw%'
      AND COALESCE("reviewStatus", '') NOT ILIKE '%cancel%'
    `);
  }

  return Prisma.join(conditions, " AND ");
}

export async function getSkeapAdminViewCounts(
  range: { start: Date; end: Date },
): Promise<SkeapAdminViewCounts> {
  const rows = await prisma.$queryRaw<SkeapAdminViewCounts[]>(Prisma.sql`
    SELECT
      COUNT(*) FILTER (
        WHERE "reviewStatus" ILIKE '%pending%'
          AND "status" NOT IN ('APPROVED', 'REJECTED', 'WITHDRAWN')
          AND COALESCE("reviewStatus", '') NOT ILIKE '%withdraw%'
          AND COALESCE("reviewStatus", '') NOT ILIKE '%approve%'
          AND COALESCE("reviewStatus", '') NOT ILIKE '%reject%'
          AND COALESCE("reviewStatus", '') NOT ILIKE '%cancel%'
      )::INTEGER AS "pendingCount",
      COUNT(*) FILTER (
        WHERE "reviewStatus" ILIKE '%resubm%'
          AND "status" NOT IN ('APPROVED', 'REJECTED', 'WITHDRAWN')
          AND COALESCE("reviewStatus", '') NOT ILIKE '%withdraw%'
          AND COALESCE("reviewStatus", '') NOT ILIKE '%cancel%'
      )::INTEGER AS "resubmittedCount",
      COUNT(*) FILTER (
        WHERE (
            "reviewStatus" ILIKE '%return%'
            OR "reviewStatus" ILIKE '%correction%'
            OR "reviewStatus" ILIKE '%required%'
            OR "reviewStatus" ILIKE '%revise%'
            OR "reviewStatus" ILIKE '%revision%'
          )
          AND "status" NOT IN ('APPROVED', 'REJECTED', 'WITHDRAWN')
          AND COALESCE("reviewStatus", '') NOT ILIKE '%approve%'
          AND COALESCE("reviewStatus", '') NOT ILIKE '%reject%'
          AND COALESCE("reviewStatus", '') NOT ILIKE '%withdraw%'
          AND COALESCE("reviewStatus", '') NOT ILIKE '%cancel%'
      )::INTEGER AS "returnedCount",
      COUNT(*) FILTER (
        WHERE (
            "reviewStatus" ILIKE '%pre_qual%'
            OR "reviewStatus" ILIKE '%pre-qual%'
          )
          AND "status" NOT IN ('APPROVED', 'REJECTED', 'WITHDRAWN')
          AND COALESCE("reviewStatus", '') NOT ILIKE '%withdraw%'
          AND COALESCE("reviewStatus", '') NOT ILIKE '%cancel%'
      )::INTEGER AS "physicalCtcCount",
      COUNT(*) FILTER (
        WHERE "status" = 'WITHDRAWN'
           OR "reviewStatus" ILIKE '%withdraw%'
      )::INTEGER AS "withdrawnCount"
    FROM "public"."skeap_applications_admin_mv"
    WHERE "inquiryId" IS NOT NULL
      AND "inquiryCreatedAt" >= ${range.start}
      AND "inquiryCreatedAt" < ${range.end}
      AND COALESCE("reviewStatus", '') NOT ILIKE '%cancel%'
  `);
  return rows[0] ?? {
    pendingCount: 0,
    returnedCount: 0,
    resubmittedCount: 0,
    physicalCtcCount: 0,
    withdrawnCount: 0,
  };
}

export async function getSkeapAdminQueueRows({
  range,
  filter,
  search,
  cursor,
  inquiryId,
  take,
}: {
  range: { start: Date; end: Date };
  filter: SkeapAdminQueueFilter;
  search?: string;
  cursor?: { id: string; createdAt: Date } | null;
  inquiryId?: string;
  take: number;
}): Promise<SkeapAdminQueueRow[]> {
  const where = getSkeapAdminWhere(range, filter, search, inquiryId);
  const cursorCondition = cursor
    ? Prisma.sql`
        AND (
          "inquiryCreatedAt" < ${cursor.createdAt}
          OR ("inquiryCreatedAt" = ${cursor.createdAt} AND "inquiryId" < ${cursor.id})
        )
      `
    : Prisma.empty;

  return prisma.$queryRaw<SkeapAdminQueueRow[]>(Prisma.sql`
    SELECT "id", "inquiryId", "inquiryCreatedAt"
    FROM "public"."skeap_applications_admin_mv"
    WHERE ${where}
    ${cursorCondition}
    ORDER BY "inquiryCreatedAt" DESC, "inquiryId" DESC
    LIMIT ${take}
  `);
}

export async function countSkeapAdminQueueRows({
  range,
  filter,
  search,
}: {
  range: { start: Date; end: Date };
  filter: SkeapAdminQueueFilter;
  search?: string;
}): Promise<number> {
  const where = getSkeapAdminWhere(range, filter, search);
  const rows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(*)::INTEGER AS "count"
    FROM "public"."skeap_applications_admin_mv"
    WHERE ${where}
  `);
  return rows[0]?.count ?? 0;
}

function getKkProfilingWhere(status?: string, id?: string) {
  const conditions: Prisma.Sql[] = [];
  const normalizedStatus = status?.trim().toLowerCase().replace(/_/g, "-");
  if (normalizedStatus === "pending") {
    conditions.push(Prisma.sql`LOWER(TRIM("status")) IN ('pending', 'pending review', 'manual review')`);
  } else if (normalizedStatus === "returned") {
    conditions.push(Prisma.sql`LOWER(TRIM("status")) = 'returned'`);
  } else if (normalizedStatus === "resubmitted") {
    conditions.push(Prisma.sql`LOWER(TRIM("status")) = 'resubmitted'`);
  } else if (normalizedStatus === "physical-ctc" || normalizedStatus === "for physical ctc") {
    conditions.push(Prisma.sql`LOWER(TRIM("status")) IN ('for physical ctc', 'for_physical_ctc')`);
  } else if (normalizedStatus === "withdrawn" || normalizedStatus === "rejected") {
    conditions.push(Prisma.sql`LOWER(TRIM("status")) IN ('withdrawn', 'rejected')`);
  } else if (status) {
    conditions.push(Prisma.sql`LOWER("status") = LOWER(${status})`);
  }
  if (id) conditions.push(Prisma.sql`"id" = ${id}`);
  return conditions.length ? Prisma.join(conditions, " AND ") : null;
}

export async function getKkProfilingAdminViewCounts(): Promise<KkProfilingAdminViewCounts> {
  const rows = await prisma.$queryRaw<KkProfilingAdminViewCounts[]>(Prisma.sql`
    SELECT
      COUNT(*) FILTER (
        WHERE LOWER(TRIM("status")) IN ('pending', 'pending review', 'manual review')
      )::INTEGER AS "pendingCount",
      COUNT(*) FILTER (
        WHERE LOWER(TRIM("status")) = 'returned'
      )::INTEGER AS "returnedCount",
      COUNT(*) FILTER (
        WHERE LOWER(TRIM("status")) = 'resubmitted'
      )::INTEGER AS "resubmittedCount",
      COUNT(*) FILTER (
        WHERE LOWER(TRIM("status")) IN ('for physical ctc', 'for_physical_ctc')
      )::INTEGER AS "physicalCtcCount",
      COUNT(*) FILTER (
        WHERE LOWER(TRIM("status")) IN ('withdrawn', 'rejected')
      )::INTEGER AS "withdrawnCount"
    FROM "public"."kk_profiling_applications_admin_mv"
  `);
  return rows[0] ?? {
    pendingCount: 0,
    returnedCount: 0,
    resubmittedCount: 0,
    physicalCtcCount: 0,
    withdrawnCount: 0,
  };
}

export async function getKkProfilingAdminViewCount(status?: string): Promise<number> {
  const where = getKkProfilingWhere(status);
  const rows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(*)::INTEGER AS "count"
    FROM "public"."kk_profiling_applications_admin_mv"
    ${where ? Prisma.sql`WHERE ${where}` : Prisma.empty}
  `);
  return rows[0]?.count ?? 0;
}

export async function listKkProfilingAdminViewRows({
  status,
  id,
  take,
  skip,
}: {
  status?: string;
  id?: string;
  take: number;
  skip: number;
}): Promise<KkProfilingAdminViewRow[]> {
  const where = getKkProfilingWhere(status, id);
  return prisma.$queryRaw<KkProfilingAdminViewRow[]>(Prisma.sql`
    SELECT *
    FROM "public"."kk_profiling_applications_admin_mv"
    ${where ? Prisma.sql`WHERE ${where}` : Prisma.empty}
    ORDER BY "submittedAt" DESC, "id" DESC
    LIMIT ${take}
    OFFSET ${skip}
  `);
}
