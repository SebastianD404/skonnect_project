import { GranteeStatus, Prisma, Role, SubmissionStatus } from "@prisma/client";
import { PICO_SITIOS } from "@/lib/barangay-sitios";
import { getProfilingRegistrationCountByStatus, prisma } from "@/lib/prisma";
import { getSkeapCapacityCount, getSkeapMaxSlots } from "@/lib/skeap-capacity";

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
  scholarDistribution: Array<{ sitio: string; scholars: number }>;
  populationDistribution: Array<{ sitio: string; population: number }>;
};

export async function getScholarDistributionAnalytics(): Promise<ScholarDistributionAnalytics> {
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
    totalRegisteredYouth,
    activeScholars,
    capacityUsed,
    maxSlots,
    pendingApplications,
    scholarRows,
    populationRows,
    pendingProfilingApplications,
    genderRows,
  ] =
    await Promise.all([
      prisma.user.count({
        where: { role: { in: [Role.YOUTH, Role.GRANTEE] } },
      }),
      prisma.grantee.count({
        where: { status: GranteeStatus.ACTIVE },
      }),
      getSkeapCapacityCount(),
      getSkeapMaxSlots(),
      prisma.skeapApplication.count({
        where: { status: SubmissionStatus.PENDING },
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
        SELECT profile."sex"::text AS "sex", COUNT(*)::int AS "count"
        FROM public."kk_profiles" AS profile
        WHERE profile."isVerified" = TRUE
        GROUP BY profile."sex"
      `,
    ]);

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

  return {
    totalRegisteredYouth,
    activeScholars,
    capacityUsed,
    maxSlots,
    pendingApplications,
    pendingProfilingApplications,
    genderDistribution,
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
