DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'coeStatus'
  ) THEN
    ALTER TABLE "submissions" ADD COLUMN "coeStatus" "SubmissionStatus" NOT NULL DEFAULT 'PENDING';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'gradesStatus'
  ) THEN
    ALTER TABLE "submissions" ADD COLUMN "gradesStatus" "SubmissionStatus" NOT NULL DEFAULT 'PENDING';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'coeSubmittedAt'
  ) THEN
    ALTER TABLE "submissions" ADD COLUMN "coeSubmittedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'coeApprovedAt'
  ) THEN
    ALTER TABLE "submissions" ADD COLUMN "coeApprovedAt" TIMESTAMP(3);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'gradesSubmittedAt'
  ) THEN
    ALTER TABLE "submissions" ADD COLUMN "gradesSubmittedAt" TIMESTAMP(3);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'gradesApprovedAt'
  ) THEN
    ALTER TABLE "submissions" ADD COLUMN "gradesApprovedAt" TIMESTAMP(3);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'Submission_coeStatus_submittedAt_idx'
  ) THEN
    CREATE INDEX "Submission_coeStatus_submittedAt_idx"
      ON "submissions" ("coeStatus", "submittedAt" DESC);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'Submission_gradesStatus_gradesSubmittedAt_idx'
  ) THEN
    CREATE INDEX "Submission_gradesStatus_gradesSubmittedAt_idx"
      ON "submissions" ("gradesStatus", "gradesSubmittedAt" DESC);
  END IF;
END $$;
