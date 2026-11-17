ALTER TABLE "grantees"
ADD COLUMN "entryAcademicYear" TEXT,
ADD COLUMN "entrySemester" TEXT;

WITH enrollment_terms AS (
  SELECT
    "id",
    EXTRACT(YEAR FROM local_enrollment)::INTEGER AS local_year,
    EXTRACT(MONTH FROM local_enrollment)::INTEGER AS local_month
  FROM (
    SELECT
      "id",
      "dateEnrolled" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila' AS local_enrollment
    FROM "grantees"
  ) AS local_dates
)
UPDATE "grantees" AS grantee
SET
  "entryAcademicYear" = CASE
    WHEN enrollment_terms.local_month BETWEEN 1 AND 5
      THEN (enrollment_terms.local_year - 1)::TEXT || '-' || enrollment_terms.local_year::TEXT
    ELSE enrollment_terms.local_year::TEXT || '-' || (enrollment_terms.local_year + 1)::TEXT
  END,
  "entrySemester" = CASE
    WHEN enrollment_terms.local_month BETWEEN 6 AND 10 THEN 'First Semester'
    ELSE 'Second Semester'
  END
FROM enrollment_terms
WHERE grantee."id" = enrollment_terms."id";

ALTER TYPE "AccountingPayoutStatus"
ADD VALUE IF NOT EXISTS 'NOT_YET_FILED';
