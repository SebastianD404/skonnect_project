CREATE TYPE "SubmissionOcrStatus" AS ENUM (
  'OCR_PENDING',
  'OCR_DONE',
  'OCR_NEEDS_REVIEW',
  'OCR_FAILED'
);

ALTER TABLE "submissions"
  ADD COLUMN "gradeReportSemester" TEXT,
  ADD COLUMN "ocrRawText" TEXT,
  ADD COLUMN "ocrParsedRows" JSONB,
  ADD COLUMN "ocrGwa" DOUBLE PRECISION,
  ADD COLUMN "ocrTotalUnits" DOUBLE PRECISION,
  ADD COLUMN "ocrConfidence" DOUBLE PRECISION,
  ADD COLUMN "ocrStatus" "SubmissionOcrStatus" NOT NULL DEFAULT 'OCR_PENDING';
