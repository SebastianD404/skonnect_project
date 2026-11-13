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
  programOutcomes: {
    activeGrantees: number;
    graduated: number;
    removedOrRevoked: number;
  };
  scholarDistribution: Array<{ sitio: string; scholars: number }>;
  populationDistribution: Array<{ sitio: string; population: number }>;
};

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
    genderRows,
    youthGenderRows,
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
      prisma.$queryRaw<Array<{ sex: string; count: number }>>`
        SELECT COALESCE(profile."sex"::text, 'NOT_SPECIFIED') AS "sex", COUNT(*)::int AS "count"
        FROM public."grantees" AS grantee
        INNER JOIN public."users" AS user_record ON user_record."id" = grantee."userId"
        LEFT JOIN public."kk_profiles" AS profile ON profile."id" = user_record."kkProfileId"
        WHERE grantee."status" IN ('ACTIVE', 'PROBATIONARY', 'GRADUATED', 'REMOVED', 'REVOKED')
        GROUP BY profile."sex"
      `,
      prisma.$queryRaw<Array<{ sex: string; count: number }>>`
        SELECT COALESCE(profile."sex"::text, 'NOT_SPECIFIED') AS "sex", COUNT(*)::int AS "count"
        FROM public."users" AS user_record
        LEFT JOIN public."kk_profiles" AS profile ON profile."id" = user_record."kkProfileId"
        WHERE user_record."role" IN ('YOUTH', 'GRANTEE')
        GROUP BY profile."sex"
      `,
      prisma.grantee.groupBy({
        by: ["yearLevel"],
        where: {
          status: {
            in: [
              GranteeStatus.ACTIVE,
              GranteeStatus.PROBATIONARY,
              GranteeStatus.GRADUATED,
              GranteeStatus.REMOVED,
              GranteeStatus.REVOKED,
            ],
          },
        },
        _count: { _all: true },
      }),
    ]);
  const totalRegisteredYouth = totalRegisteredYouthRows[0]?.count ?? 0;

  const scholarCountsBySitio = new Map(
    scholarRows.map((row) => [row.sitio?.trim().toLowerCase() ?? "", row.scholars]),
  );
  const populationCountsBySitio = new Map(
    populationRows.map((row) => [row.sitio?.trim().toLowerCase() ?? "", row.population]),
  );
  const genderDistribution = {
    male: 0,
    female: 0,
    notSpecified: 0,
  };
  for (const row of genderRows) {
    if (row.sex === "MALE") genderDistribution.male = row.count;
    if (row.sex === "FEMALE") genderDistribution.female = row.count;
    if (row.sex === "NOT_SPECIFIED") genderDistribution.notSpecified = row.count;
  }
  const youthGenderDistribution = {
    male: 0,
    female: 0,
    notSpecified: 0,
  };
  for (const row of youthGenderRows) {
    if (row.sex === "MALE") youthGenderDistribution.male = row.count;
    if (row.sex === "FEMALE") youthGenderDistribution.female = row.count;
    if (row.sex === "NOT_SPECIFIED") youthGenderDistribution.notSpecified = row.count;
  }
  const granteeCountsByStatus = new Map(
    granteeStatusRows.map((row) => [row.status, row._count._all]),
  );
  const yearLevelCounts = new Map<string, number>();
  for (const row of yearLevelRows) {
    const key = row.yearLevel.trim().toLocaleLowerCase();
    yearLevelCounts.set(key, (yearLevelCounts.get(key) ?? 0) + row._count._all);
  }
  const yearLevelDistribution = ["1st Year", "2nd Year", "3rd Year", "4th Year"].map(
    (yearLevel) => ({
      yearLevel,
      count: yearLevelCounts.get(yearLevel.toLocaleLowerCase()) ?? 0,
    }),
  );
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
