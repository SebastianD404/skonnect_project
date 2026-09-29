ALTER TABLE "grantees"
  ADD COLUMN IF NOT EXISTS "retentionExpiresAt" TIMESTAMP(3);

UPDATE "grantees"
SET "retentionExpiresAt" = "graduatedAt" + INTERVAL '5 years'
WHERE "status" = 'GRADUATED'
  AND "graduatedAt" IS NOT NULL
  AND "retentionExpiresAt" IS NULL;