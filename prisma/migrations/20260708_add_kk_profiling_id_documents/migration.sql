-- Add missing KK profiling identification document fields
ALTER TABLE "kk_profiling_registrations"
  ADD COLUMN IF NOT EXISTS "idDocumentType" TEXT;

ALTER TABLE "kk_profiling_registrations"
  ADD COLUMN IF NOT EXISTS "idFrontFileUrl" TEXT;

ALTER TABLE "kk_profiling_registrations"
  ADD COLUMN IF NOT EXISTS "idBackFileUrl" TEXT;

ALTER TABLE "kk_profiling_registrations"
  ADD COLUMN IF NOT EXISTS "idSingleFileUrl" TEXT;
