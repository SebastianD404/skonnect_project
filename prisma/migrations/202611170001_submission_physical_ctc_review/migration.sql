ALTER TYPE "SubmissionStatus"
ADD VALUE IF NOT EXISTS 'AWAITING_PHYSICAL_CTC';

ALTER TABLE "submissions"
ADD COLUMN "physicalVerifiedBy" TEXT,
ADD COLUMN "physicalVerifiedAt" TIMESTAMP(3);
