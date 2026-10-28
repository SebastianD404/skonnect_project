ALTER TABLE "kk_profiling_registrations"
  ADD COLUMN IF NOT EXISTS "statusChangedAt" TIMESTAMP(3);

UPDATE "kk_profiling_registrations"
SET "statusChangedAt" = "submittedAt"
WHERE "statusChangedAt" IS NULL;

ALTER TABLE "kk_profiling_registrations"
  ALTER COLUMN "statusChangedAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "statusChangedAt" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "kk_profiling_registrations_reviewStatus_statusChangedAt_idx"
  ON "kk_profiling_registrations" ("reviewStatus", "statusChangedAt" DESC);
