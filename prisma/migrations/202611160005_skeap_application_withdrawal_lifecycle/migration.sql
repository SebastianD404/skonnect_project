ALTER TYPE "SubmissionStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "SubmissionStatus" ADD VALUE IF NOT EXISTS 'WITHDRAWN';
ALTER TABLE "skeap_applications"
  ADD COLUMN "withdrawnAt" TIMESTAMP(3),
  ADD COLUMN "withdrawalReason" TEXT;
