-- Add residency acknowledgement flag to KK profiling registrations
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kk_profiling_registrations') THEN
    ALTER TABLE "kk_profiling_registrations"
      ADD COLUMN IF NOT EXISTS "residencyStatementAcknowledgement" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;
