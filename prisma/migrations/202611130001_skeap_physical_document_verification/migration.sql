ALTER TYPE "SubmissionStatus" ADD VALUE 'PRE_QUALIFIED';

ALTER TABLE "skeap_applications"
ADD COLUMN "physicalDocumentsConfirmed" BOOLEAN NOT NULL DEFAULT false;
