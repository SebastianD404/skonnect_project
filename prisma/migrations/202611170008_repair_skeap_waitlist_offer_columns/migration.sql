DO $$
BEGIN
  CREATE TYPE "WaitlistOfferStatus" AS ENUM ('NONE', 'OFFERED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

ALTER TABLE "skeap_applications"
  ADD COLUMN IF NOT EXISTS "parentGuardianName" TEXT,
  ADD COLUMN IF NOT EXISTS "waitlistOfferStatus" "WaitlistOfferStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "waitlistOfferedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "waitlistOfferExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "waitlistOfferReminderSentAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "skeap_applications_status_waitlistOfferStatus_waitlistOfferExpiresAt_idx"
  ON "skeap_applications"("status", "waitlistOfferStatus", "waitlistOfferExpiresAt");
