CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE', 'NOT_SPECIFIED');

ALTER TABLE "kk_profiles"
ADD COLUMN "sex" "Sex" NOT NULL DEFAULT 'NOT_SPECIFIED';

WITH latest_registration AS (
  SELECT DISTINCT ON (registration."userId")
    registration."userId",
    registration."sex",
    registration."reviewStatus"
  FROM "kk_profiling_registrations" AS registration
  WHERE registration."userId" IS NOT NULL
  ORDER BY registration."userId", registration."submittedAt" DESC, registration."id" DESC
)
UPDATE "kk_profiles" AS profile
SET
  "sex" = CASE
    WHEN LOWER(BTRIM(latest_registration."sex")) IN ('male', 'm') THEN 'MALE'::"Sex"
    WHEN LOWER(BTRIM(latest_registration."sex")) IN ('female', 'f') THEN 'FEMALE'::"Sex"
    ELSE 'NOT_SPECIFIED'::"Sex"
  END,
  "isVerified" = LOWER(BTRIM(latest_registration."reviewStatus")) = 'approved'
FROM "users" AS account
INNER JOIN latest_registration
  ON latest_registration."userId" = account."id"
WHERE account."kkProfileId" = profile."id";
