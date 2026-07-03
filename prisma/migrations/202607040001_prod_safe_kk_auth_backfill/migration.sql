-- Production-safe migration for KK profile linkage, temporary credential flags,
-- SKEAP applications table, and data backfill from existing profiling records.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "username" TEXT,
  ADD COLUMN IF NOT EXISTS "mustSecureAccount" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "usesTemporaryPassword" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "kkProfileId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "users_kkProfileId_key" ON "users"("kkProfileId");

CREATE TABLE IF NOT EXISTS "kk_profiles" (
  "id" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "middleName" TEXT,
  "lastName" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "purok" TEXT NOT NULL,
  "addressLine" TEXT NOT NULL,
  "barangay" TEXT NOT NULL DEFAULT 'Pico',
  "birthDate" TIMESTAMP(3) NOT NULL,
  "contactNumber" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "isVerified" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kk_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "kk_profiles_email_key" ON "kk_profiles"("email");
CREATE INDEX IF NOT EXISTS "kk_profiles_lastName_firstName_idx" ON "kk_profiles"("lastName", "firstName");

CREATE TABLE IF NOT EXISTS "skeap_applications" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "currentCourse" TEXT NOT NULL,
  "yearLevel" TEXT NOT NULL,
  "gwa" DECIMAL(4, 2),
  "enrollmentFileUrl" TEXT NOT NULL,
  "reportCardFileUrl" TEXT NOT NULL,
  "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "skeap_applications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "skeap_applications_userId_submittedAt_idx" ON "skeap_applications"("userId", "submittedAt" DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_kkProfileId_fkey'
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_kkProfileId_fkey"
      FOREIGN KEY ("kkProfileId") REFERENCES "kk_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'skeap_applications_userId_fkey'
  ) THEN
    ALTER TABLE "skeap_applications"
      ADD CONSTRAINT "skeap_applications_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill usernames from email for existing users without username.
WITH username_candidates AS (
  SELECT
    u."id",
    lower(trim(u."email")) AS uname,
    row_number() OVER (
      PARTITION BY lower(trim(u."email"))
      ORDER BY u."createdAt", u."id"
    ) AS rn
  FROM "users" u
  WHERE u."username" IS NULL
)
UPDATE "users" u
SET "username" = CASE
  WHEN c.rn = 1 THEN c.uname
  ELSE c.uname || '.' || left(u."id", 8)
END
FROM username_candidates c
WHERE u."id" = c."id";

-- Backfill kk_profiles from latest rows in kk_profiling_registrations when available.
DO $$
BEGIN
  IF to_regclass('public.kk_profiling_registrations') IS NOT NULL THEN
    INSERT INTO "kk_profiles" (
      "id",
      "firstName",
      "middleName",
      "lastName",
      "fullName",
      "purok",
      "addressLine",
      "barangay",
      "birthDate",
      "contactNumber",
      "email",
      "isVerified",
      "createdAt",
      "updatedAt"
    )
    SELECT
      uuid_generate_v4()::text,
      split_part(trim(src."fullName"), ' ', 1) AS "firstName",
      CASE
        WHEN array_length(regexp_split_to_array(trim(src."fullName"), '\\s+'), 1) > 2
          THEN array_to_string((regexp_split_to_array(trim(src."fullName"), '\\s+'))[2:array_length(regexp_split_to_array(trim(src."fullName"), '\\s+'), 1)-1], ' ')
        ELSE NULL
      END AS "middleName",
      CASE
        WHEN strpos(trim(src."fullName"), ' ') > 0
          THEN regexp_replace(trim(src."fullName"), '^.*\\s+', '')
        ELSE split_part(trim(src."fullName"), ' ', 1)
      END AS "lastName",
      trim(src."fullName") AS "fullName",
      CASE
        WHEN lower(split_part(src."address", ',', 1)) LIKE 'purok %'
          THEN initcap(trim(split_part(src."address", ',', 1)))
        ELSE 'Purok 1'
      END AS "purok",
      COALESCE(NULLIF(trim(regexp_replace(src."address", '^[^,]+,?\\s*', '')), ''), 'Address pending verification') AS "addressLine",
      'Pico' AS "barangay",
      src."birthDate",
      COALESCE(NULLIF(trim(src."contactNumber"), ''), 'N/A') AS "contactNumber",
      lower(trim(src."email")) AS "email",
      true,
      now(),
      now()
    FROM (
      SELECT DISTINCT ON (lower(trim(r."email")))
        r."fullName",
        r."address",
        r."birthDate",
        r."contactNumber",
        r."email",
        r."submittedAt"
      FROM "kk_profiling_registrations" r
      WHERE trim(COALESCE(r."email", '')) <> ''
      ORDER BY lower(trim(r."email")), r."submittedAt" DESC
    ) src
    LEFT JOIN "kk_profiles" kp
      ON lower(kp."email") = lower(trim(src."email"))
    WHERE kp."id" IS NULL;
  END IF;
END $$;

-- Link users to kk_profiles by email when not yet linked.
UPDATE "users" u
SET "kkProfileId" = kp."id"
FROM "kk_profiles" kp
WHERE u."kkProfileId" IS NULL
  AND lower(trim(u."email")) = lower(trim(kp."email"));

-- Backfill selected user fields from linked kk profile if missing.
UPDATE "users" u
SET
  "fullName" = COALESCE(NULLIF(u."fullName", ''), kp."fullName"),
  "phoneNumber" = COALESCE(u."phoneNumber", NULLIF(kp."contactNumber", 'N/A')),
  "barangay" = COALESCE(NULLIF(u."barangay", ''), 'Pico')
FROM "kk_profiles" kp
WHERE u."kkProfileId" = kp."id";
