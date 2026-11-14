import { GranteeStatus, Prisma } from "@prisma/client";
import { PICO_SITIOS } from "@/lib/barangay-sitios";
import { getProfilingRegistrationCountByStatus, prisma } from "@/lib/prisma";
import { getSkeapCapacityCount, getSkeapMaxSlots } from "@/lib/skeap-capacity";
import { getAcademicYearDateRange, getCurrentAcademicYear } from "@/lib/semester";
import { skeapPendingApplicationsWhere } from "@/lib/skeap-applications";

export type ScholarDistributionAnalytics = {
  totalRegisteredYouth: number;
  activeScholars: number;
  capacityUsed: number;
  maxSlots: number;
  pendingApplications: number;
  pendingProfilingApplications: number;
  genderDistribution: {
    male: number;
    female: number;
    notSpecified: number;
  };
  youthGenderDistribution: {
    male: number;
    female: number;
    notSpecified: number;
  };
  yearLevelDistribution: Array<{ yearLevel: string; count: number }>;
  yearLevelBreakdowns: {
    all: Array<{ yearLevel: string; count: number }>;
    highSchool: Array<{ yearLevel: string; count: number }>;
    college: Array<{ yearLevel: string; count: number }>;
  };
  programOutcomes: {
    activeGrantees: number;
    graduated: number;
    removedOrRevoked: number;
  };
  scholarDistribution: Array<{ sitio: string; scholars: number }>;
  populationDistribution: Array<{ sitio: string; population: number }>;
};

type CountedValue = { sex?: string | null; yearLevel?: string | null; count: number };

export function normalizeSexDistribution(rows: CountedValue[]) {
  const distribution = { male: 0, female: 0, notSpecified: 0 };
  for (const row of rows) {
    const value = row.sex?.trim().toUpperCase();
    if (value === "MALE" || value === "M") distribution.male += row.count;
    else if (value === "FEMALE" || value === "F") distribution.female += row.count;
    else distribution.notSpecified += row.count;
  }
  return distribution;
}

function getHighSchoolGrade(yearLevel: string) {
  const match = yearLevel.match(/\b(?:grade|gr\.?)\s*(7|8|9|10|11|12)\b/i);
  if (match) return Number(match[1]);
  const ordinalMatch = yearLevel.match(/\b(7|8|9|10|11|12)(?:st|nd|rd|th)\s+grade\b/i);
  return ordinalMatch ? Number(ordinalMatch[1]) : null;
}

function getCollegeYearBucket(yearLevel: string) {
  const normalized = yearLevel.trim().toLowerCase();
  if (/\b(?:1st|first)\s+year\b/.test(normalized) || /incoming freshman/.test(normalized)) return "1st Year";
  if (/\b(?:2nd|second)\s+year\b/.test(normalized)) return "2nd Year";
  if (/\b(?:3rd|third)\s+year\b/.test(normalized)) return "3rd Year";
  if (/\b(?:4th|fourth|5th|fifth|6th|sixth)\s+year\b/.test(normalized) || /tech.?voc|technical|vocational/.test(normalized)) {
    return "4th Year+";
  }
  return null;
}

export function buildYearLevelDistributions(rows: CountedValue[]) {
  const allCounts = new Map<string, number>();
  const highSchoolCounts = new Map<number, number>();
  const collegeCounts = new Map<string, number>();

  for (const row of rows) {
    const yearLevel = row.yearLevel?.trim() ?? "";
    const grade = getHighSchoolGrade(yearLevel);
    if (grade !== null) {
      const schoolBucket = grade <= 10 ? "Junior High" : "Senior High";
      allCounts.set(schoolBucket, (allCounts.get(schoolBucket) ?? 0) + row.count);
      highSchoolCounts.set(grade, (highSchoolCounts.get(grade) ?? 0) + row.count);
      continue;
    }

    const collegeBucket = getCollegeYearBucket(yearLevel);
    if (collegeBucket) {
      allCounts.set("College", (allCounts.get("College") ?? 0) + row.count);
      collegeCounts.set(collegeBucket, (collegeCounts.get(collegeBucket) ?? 0) + row.count);
    }
  }

  const all = ["Junior High", "Senior High", "College"].map((yearLevel) => ({
    yearLevel,
    count: allCounts.get(yearLevel) ?? 0,
  }));
  const highSchool = [7, 8, 9, 10, 11, 12].map((grade) => ({
    yearLevel: `Grade ${grade}`,
    count: highSchoolCounts.get(grade) ?? 0,
  }));
  const college = ["1st Year", "2nd Year", "3rd Year", "4th Year+"].map((yearLevel) => ({
    yearLevel,
    count: collegeCounts.get(yearLevel) ?? 0,
  }));

  return { all, highSchool, college };
}

export async function getScholarDistributionAnalytics(): Promise<ScholarDistributionAnalytics> {
  const currentAcademicYearRange = getAcademicYearDateRange(getCurrentAcademicYear());
  if (!currentAcademicYearRange) {
    throw new Error("Unable to determine the current SKEAP academic year.");
  }

  const registrationSitioCases = Prisma.join(
    PICO_SITIOS.map(
      (sitio) => Prisma.sql`
        WHEN profile."purok" ILIKE ${`%${sitio}%`}
          OR profile."address" ILIKE ${`%${sitio}%`}
        THEN ${sitio}
      `,
    ),
    " ",
  );
  const [
    totalRegisteredYouthRows,
    granteeStatusRows,
    capacityUsed,
    maxSlots,
    pendingApplications,
    scholarRows,
    populationRows,
    pendingProfilingApplications,
    youthGenderRows,
    genderRows,
    yearLevelRows,
  ] =
    await Promise.all([
      prisma.$queryRaw<Array<{ count: number }>>`
        WITH ranked_profiles AS (
          SELECT
            registration."id",
            ROW_NUMBER() OVER (
              PARTITION BY COALESCE(
                NULLIF(LOWER(BTRIM(user_record."email")), ''),
                NULLIF(LOWER(BTRIM(registration."email")), ''),
                NULLIF(registration."userId", ''),
                registration."id"
              )
              ORDER BY registration."submittedAt" DESC, registration."id" DESC
            ) AS identity_rank
          FROM public."kk_profiling_registrations" AS registration
          LEFT JOIN public."users" AS user_record
            ON user_record."id" = registration."userId"
          WHERE registration."reviewStatus" = 'Approved'
        )
        SELECT COUNT(*)::int AS count
        FROM ranked_profiles
        WHERE identity_rank = 1
      `,
      prisma.grantee.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      getSkeapCapacityCount(),
      getSkeapMaxSlots(),
      prisma.inquiry.count({
        where: skeapPendingApplicationsWhere(currentAcademicYearRange),
      }),
      prisma.$queryRaw<Array<{ sitio: string | null; scholars: number }>>`
        WITH skeap_users AS (
          SELECT grantee."userId" AS "userId"
          FROM public."grantees" AS grantee
          WHERE grantee."status" = 'ACTIVE'
          UNION
          SELECT application."userId" AS "userId"
          FROM public."skeap_applications" AS application
          WHERE application."status" = 'APPROVED'
        )
        SELECT profile."purok" AS sitio, COUNT(*)::int AS scholars
        FROM skeap_users
        INNER JOIN public."users" AS user_record ON user_record."id" = skeap_users."userId"
        LEFT JOIN public."kk_profiles" AS profile ON profile."id" = user_record."kkProfileId"
        GROUP BY profile."purok"
      `,
      prisma.$queryRaw<Array<{ sitio: string | null; population: number }>>`
        WITH ranked_profiles AS (
          SELECT
            registration."id",
            registration."address",
            profile."purok",
            ROW_NUMBER() OVER (
              PARTITION BY COALESCE(
                NULLIF(LOWER(BTRIM(user_record."email")), ''),
                NULLIF(LOWER(BTRIM(registration."email")), ''),
                NULLIF(registration."userId", ''),
                registration."id"
              )
              ORDER BY registration."submittedAt" DESC, registration."id" DESC
            ) AS identity_rank
          FROM public."kk_profiling_registrations" AS registration
          LEFT JOIN public."users" AS user_record
            ON user_record."id" = registration."userId"
          LEFT JOIN public."kk_profiles" AS profile
            ON profile."id" = user_record."kkProfileId"
          WHERE registration."reviewStatus" = 'Approved'
        ),
        unique_profiles AS (
          SELECT "address", "purok"
          FROM ranked_profiles
          WHERE identity_rank = 1
        ),
        profiles_by_sitio AS (
          SELECT
            CASE ${registrationSitioCases} ELSE NULL END AS sitio
          FROM unique_profiles AS profile
        )
        SELECT sitio, COUNT(*)::int AS population
        FROM profiles_by_sitio
        WHERE sitio IS NOT NULL
        GROUP BY sitio
      `,
      getProfilingRegistrationCountByStatus("Pending"),
      prisma.$queryRaw<Array<{ sex: string | null; count: number }>>`
        WITH ranked_profiles AS (
          SELECT
            registration."id",
            COALESCE(
              NULLIF(BTRIM(registration."sex"), ''),
              NULLIF(BTRIM(profile."sex"::text), ''),
              'NOT_SPECIFIED'
            ) AS "sex",
            ROW_NUMBER() OVER (
              PARTITION BY COALESCE(
                NULLIF(LOWER(BTRIM(user_record."email")), ''),
                NULLIF(LOWER(BTRIM(registration."email")), ''),
                NULLIF(registration."userId", ''),
                registration."id"
              )
              ORDER BY registration."submittedAt" DESC, registration."id" DESC
            ) AS identity_rank
          FROM public."kk_profiling_registrations" AS registration
          LEFT JOIN public."users" AS user_record
            ON user_record."id" = registration."userId"
          LEFT JOIN public."kk_profiles" AS profile
            ON profile."id" = user_record."kkProfileId"
          WHERE registration."reviewStatus" = 'Approved'
        )
        SELECT "sex", COUNT(*)::int AS "count"
        FROM ranked_profiles
        WHERE identity_rank = 1
        GROUP BY "sex"
      `,
      prisma.$queryRaw<Array<{ sex: string | null; count: number }>>`
        WITH latest_approved_registration AS (
          SELECT DISTINCT ON (registration."userId")
            registration."userId",
            registration."sex"
          FROM public."kk_profiling_registrations" AS registration
          WHERE registration."userId" IS NOT NULL
            AND LOWER(BTRIM(registration."reviewStatus")) = 'approved'
          ORDER BY registration."userId", registration."submittedAt" DESC, registration."id" DESC
        ),
        latest_skeap_application AS (
          SELECT DISTINCT ON (application."userId")
            application."userId",
            application."gender"
          FROM public."skeap_applications" AS application
          WHERE application."userId" IS NOT NULL
            AND NULLIF(BTRIM(application."gender"), '') IS NOT NULL
          ORDER BY application."userId", application."submittedAt" DESC, application."id" DESC
        )
        SELECT CASE
          WHEN profile."sex"::text IN ('MALE', 'FEMALE') THEN profile."sex"::text
          WHEN LOWER(BTRIM(registration."sex")) IN ('male', 'm') THEN 'MALE'
          WHEN LOWER(BTRIM(registration."sex")) IN ('female', 'f') THEN 'FEMALE'
          WHEN LOWER(BTRIM(application."gender")) IN ('male', 'm') THEN 'MALE'
          WHEN LOWER(BTRIM(application."gender")) IN ('female', 'f') THEN 'FEMALE'
          ELSE 'NOT_SPECIFIED'
        END AS "sex", COUNT(*)::int AS "count"
        FROM public."grantees" AS grantee
        INNER JOIN public."users" AS user_record ON user_record."id" = grantee."userId"
        LEFT JOIN public."kk_profiles" AS profile ON profile."id" = user_record."kkProfileId"
        LEFT JOIN latest_approved_registration AS registration
          ON registration."userId" = grantee."userId"
        LEFT JOIN latest_skeap_application AS application
          ON application."userId" = grantee."userId"
        WHERE grantee."status" IN ('ACTIVE', 'PROBATIONARY', 'GRADUATED', 'REMOVED', 'REVOKED')
        GROUP BY 1
      `,
      prisma.$queryRaw<Array<{ yearLevel: string | null; count: number }>>`
        WITH scholar_year_levels AS (
          SELECT grantee."userId", grantee."yearLevel", 1 AS source_priority
          FROM public."grantees" AS grantee
          WHERE grantee."status" = 'ACTIVE'
          UNION ALL
          SELECT application."userId", application."yearLevel", 2 AS source_priority
          FROM public."skeap_applications" AS application
          WHERE application."status" = 'APPROVED'
        ),
        active_scholars AS (
          SELECT "userId", "yearLevel"
          FROM (
            SELECT
              "userId",
              "yearLevel",
              ROW_NUMBER() OVER (
                PARTITION BY "userId"
                ORDER BY source_priority
              ) AS scholar_rank
            FROM scholar_year_levels
          ) AS ranked_scholars
          WHERE scholar_rank = 1
        )
        SELECT "yearLevel", COUNT(*)::int AS "count"
        FROM active_scholars
        GROUP BY "yearLevel"
      `,
    ]);
  const totalRegisteredYouth = totalRegisteredYouthRows[0]?.count ?? 0;

  const scholarCountsBySitio = new Map(
    scholarRows.map((row) => [row.sitio?.trim().toLowerCase() ?? "", row.scholars]),
  );
  const populationCountsBySitio = new Map(
    populationRows.map((row) => [row.sitio?.trim().toLowerCase() ?? "", row.population]),
  );
  const genderDistribution = normalizeSexDistribution(genderRows);
  const youthGenderDistribution = normalizeSexDistribution(youthGenderRows);
  const granteeCountsByStatus = new Map(
    granteeStatusRows.map((row) => [row.status, row._count._all]),
  );
  const yearLevelBreakdowns = buildYearLevelDistributions(yearLevelRows);
  const yearLevelDistribution = yearLevelBreakdowns.all;
  const programOutcomes = {
    activeGrantees:
      (granteeCountsByStatus.get(GranteeStatus.ACTIVE) ?? 0) +
      (granteeCountsByStatus.get(GranteeStatus.PROBATIONARY) ?? 0),
    graduated: granteeCountsByStatus.get(GranteeStatus.GRADUATED) ?? 0,
    removedOrRevoked:
      (granteeCountsByStatus.get(GranteeStatus.REMOVED) ?? 0) +
      (granteeCountsByStatus.get(GranteeStatus.REVOKED) ?? 0),
  };

  return {
    totalRegisteredYouth,
    activeScholars: granteeCountsByStatus.get(GranteeStatus.ACTIVE) ?? 0,
    capacityUsed,
    maxSlots,
    pendingApplications,
    pendingProfilingApplications,
    genderDistribution,
    youthGenderDistribution,
    yearLevelDistribution,
    yearLevelBreakdowns,
    programOutcomes,
    scholarDistribution: PICO_SITIOS.map((sitio) => ({
      sitio,
      scholars: scholarCountsBySitio.get(sitio.toLowerCase()) ?? 0,
    })),
    populationDistribution: PICO_SITIOS.map((sitio) => ({
      sitio,
      population: populationCountsBySitio.get(sitio.toLowerCase()) ?? 0,
    })),
  };
}
