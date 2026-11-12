CREATE TYPE "AccountingPayoutStatus" AS ENUM (
  'PENDING',
  'DISBURSED_UNCONFIRMED',
  'CONFIRMED'
);

ALTER TABLE "accounting_payouts"
ADD COLUMN "status" "AccountingPayoutStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "disbursed_at" TIMESTAMP(3),
ADD COLUMN "disbursement_email_sent_at" TIMESTAMP(3);

UPDATE "accounting_payouts"
SET
  "status" = CASE
    WHEN "claimed_at" IS NOT NULL THEN 'CONFIRMED'::"AccountingPayoutStatus"
    ELSE 'PENDING'::"AccountingPayoutStatus"
  END,
  "disbursed_at" = "claimed_at";

ALTER TABLE "notifications"
ADD COLUMN "message" TEXT;
