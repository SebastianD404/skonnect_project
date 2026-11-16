ALTER TABLE "grantees"
ADD COLUMN "graduationReadyAt" TIMESTAMP(3);

ALTER TABLE "admin_notifications"
ADD COLUMN "sourceKey" TEXT;

CREATE UNIQUE INDEX "admin_notifications_sourceKey_key"
ON "admin_notifications"("sourceKey");
