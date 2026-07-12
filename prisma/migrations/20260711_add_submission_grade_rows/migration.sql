-- Add gradeRows JSON column to store submitted grade rows for a submission
ALTER TABLE "submissions"
ADD COLUMN IF NOT EXISTS "gradeRows" JSONB;
