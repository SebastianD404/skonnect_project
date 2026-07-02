DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'SubmissionStatus'
      AND e.enumlabel = 'RETURNED_FOR_EDIT'
  ) THEN
    ALTER TYPE "SubmissionStatus" ADD VALUE 'RETURNED_FOR_EDIT';
  END IF;
END $$;

ALTER TABLE "submissions"
ADD COLUMN IF NOT EXISTS "flaggedFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
