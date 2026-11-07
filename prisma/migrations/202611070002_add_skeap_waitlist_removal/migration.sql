ALTER TYPE "SubmissionStatus" ADD VALUE IF NOT EXISTS 'REMOVED';

ALTER TABLE "skeap_applications"
  ADD COLUMN IF NOT EXISTS "waitlist_remark" TEXT;
