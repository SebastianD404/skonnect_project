import { Prisma } from "@prisma/client";

export const VERIFIED_KK_YOUTH_WHERE = {
  reviewStatus: "Approved",
  archivedAt: null,
  user: { is: { isActive: true } },
} satisfies Prisma.ProfilingRegistrationWhereInput;

export function createVerifiedKkYouthCte({
  regularOnly = false,
  archivedAtColumnAvailable = true,
}: {
  regularOnly?: boolean;
  archivedAtColumnAvailable?: boolean;
} = {}) {
  return Prisma.sql`
    WITH ranked_profiles AS (
      SELECT
        registration."id",
        registration."youthClassification",
        registration."submittedAt",
        registration."fullName",
        registration."email",
        registration."address",
        registration."registeredSKVoter",
        registration."sex" AS "registrationSex",
        profile."sex"::text AS "profileSex",
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
      LEFT JOIN public."grantees" AS grantee_record
        ON grantee_record."userId" = user_record."id"
      LEFT JOIN public."kk_profiles" AS profile
        ON profile."id" = user_record."kkProfileId"
      WHERE registration."reviewStatus" = ${VERIFIED_KK_YOUTH_WHERE.reviewStatus}
        ${
          archivedAtColumnAvailable && VERIFIED_KK_YOUTH_WHERE.archivedAt === null
            ? Prisma.sql`AND registration."archived_at" IS NULL`
            : Prisma.empty
        }
        AND user_record."isActive" = ${VERIFIED_KK_YOUTH_WHERE.user.is.isActive}
        AND (
          ${!regularOnly}::boolean
          OR user_record."role"::text IS DISTINCT FROM 'GRANTEE'
          OR grantee_record."status"::text IS DISTINCT FROM 'ACTIVE'
        )
    ),
    unique_profiles AS (
      SELECT
        "id",
        "youthClassification",
        "submittedAt",
        "fullName",
        "email",
        "address",
        "registeredSKVoter",
        "registrationSex",
        "profileSex",
        "purok"
      FROM ranked_profiles
      WHERE identity_rank = 1
    )
  `;
}
