ALTER TABLE "kk_profiling_registrations"
  ADD COLUMN IF NOT EXISTS "archived_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "kk_profiling_registrations_reviewStatus_birthDate_idx"
  ON "kk_profiling_registrations" ("reviewStatus", "birthDate");
