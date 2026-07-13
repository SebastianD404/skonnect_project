-- Add missing columns for SKEAP applications so the Prisma schema and database stay aligned.

ALTER TABLE "skeap_applications"
  ADD COLUMN IF NOT EXISTS "school" TEXT,
  ADD COLUMN IF NOT EXISTS "grades" JSONB,
  ADD COLUMN IF NOT EXISTS "timeline" JSONB;
