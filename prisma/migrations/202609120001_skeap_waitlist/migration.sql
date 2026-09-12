-- Add waitlist support for SKEAP applications.
ALTER TYPE "SubmissionStatus" ADD VALUE IF NOT EXISTS 'WAITLISTED';

ALTER TABLE "skeap_applications"
  ADD COLUMN IF NOT EXISTS "waitlistPosition" INTEGER;

-- Align existing approved inquiry records with the application status used by
-- the new capacity check.
UPDATE "skeap_applications" AS application
SET "status" = 'APPROVED'
FROM "inquiries" AS inquiry
WHERE inquiry."applicationId" = application."id"
  AND inquiry."reviewStatus" ILIKE '%approve%'
  AND application."status" <> 'APPROVED';

CREATE INDEX IF NOT EXISTS "skeap_applications_status_waitlistPosition_idx"
  ON "skeap_applications" ("status", "waitlistPosition");