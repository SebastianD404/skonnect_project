ALTER TYPE "GranteeStatus" ADD VALUE IF NOT EXISTS 'REVOKED';

ALTER TABLE "grantees"
  ADD COLUMN "revocationReason" TEXT,
  ADD COLUMN "revocationNotes" TEXT;
