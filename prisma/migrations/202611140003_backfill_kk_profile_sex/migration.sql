WITH latest_approved_registration AS (
  SELECT DISTINCT ON (registration."userId")
    registration."userId",
    registration."sex"
  FROM "kk_profiling_registrations" AS registration
  WHERE registration."userId" IS NOT NULL
    AND LOWER(BTRIM(registration."reviewStatus")) = 'approved'
  ORDER BY registration."userId", registration."submittedAt" DESC, registration."id" DESC
),
latest_skeap_application AS (
  SELECT DISTINCT ON (application."userId")
    application."userId",
    application."gender"
  FROM "skeap_applications" AS application
  WHERE application."userId" IS NOT NULL
    AND NULLIF(BTRIM(application."gender"), '') IS NOT NULL
  ORDER BY application."userId", application."submittedAt" DESC, application."id" DESC
)
UPDATE "kk_profiles" AS profile
SET "sex" = CASE
  WHEN LOWER(BTRIM(registration."sex")) IN ('male', 'm') THEN 'MALE'::"Sex"
  WHEN LOWER(BTRIM(registration."sex")) IN ('female', 'f') THEN 'FEMALE'::"Sex"
  WHEN LOWER(BTRIM(application."gender")) IN ('male', 'm') THEN 'MALE'::"Sex"
  WHEN LOWER(BTRIM(application."gender")) IN ('female', 'f') THEN 'FEMALE'::"Sex"
  ELSE profile."sex"
END
FROM "users" AS account
LEFT JOIN latest_approved_registration AS registration
  ON registration."userId" = account."id"
LEFT JOIN latest_skeap_application AS application
  ON application."userId" = account."id"
WHERE account."kkProfileId" = profile."id"
  AND profile."sex" = 'NOT_SPECIFIED'::"Sex"
  AND (
    LOWER(BTRIM(registration."sex")) IN ('male', 'm', 'female', 'f')
    OR LOWER(BTRIM(application."gender")) IN ('male', 'm', 'female', 'f')
  );
