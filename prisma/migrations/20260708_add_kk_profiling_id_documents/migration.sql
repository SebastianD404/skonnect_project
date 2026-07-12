-- Add missing KK profiling identification document fields (guarded)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kk_profiling_registrations') THEN
    ALTER TABLE "kk_profiling_registrations"
      ADD COLUMN IF NOT EXISTS "idDocumentType" TEXT;

    ALTER TABLE "kk_profiling_registrations"
      ADD COLUMN IF NOT EXISTS "idFrontFileUrl" TEXT;

    ALTER TABLE "kk_profiling_registrations"
      ADD COLUMN IF NOT EXISTS "idBackFileUrl" TEXT;

    ALTER TABLE "kk_profiling_registrations"
      ADD COLUMN IF NOT EXISTS "idSingleFileUrl" TEXT;
  END IF;
END $$;
