CREATE TYPE "GranteeRevocationNotificationStatus" AS ENUM (
  'NOT_REQUIRED',
  'PENDING',
  'SENDING',
  'FAILED',
  'SENT'
);

ALTER TABLE "grantees"
  ADD COLUMN "revocationNotificationStatus" "GranteeRevocationNotificationStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN "revocationNotificationAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "revocationNotificationError" TEXT,
  ADD COLUMN "revocationNotificationSentAt" TIMESTAMP(3);
