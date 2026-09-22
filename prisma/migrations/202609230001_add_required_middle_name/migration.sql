ALTER TABLE "kk_profiling_registrations"
  ADD COLUMN IF NOT EXISTS "middleName" TEXT NOT NULL DEFAULT '';
