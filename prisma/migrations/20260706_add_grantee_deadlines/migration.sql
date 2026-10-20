DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grantees' AND column_name = 'approvalDate'
  ) THEN
    ALTER TABLE "grantees" ADD COLUMN "approvalDate" TIMESTAMP(3);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grantees' AND column_name = 'enrollmentDeadline'
  ) THEN
    ALTER TABLE "grantees" ADD COLUMN "enrollmentDeadline" TIMESTAMP(3);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grantees' AND column_name = 'gradeReportDeadline'
  ) THEN
    ALTER TABLE "grantees" ADD COLUMN "gradeReportDeadline" TIMESTAMP(3);
  END IF;
END $$;
