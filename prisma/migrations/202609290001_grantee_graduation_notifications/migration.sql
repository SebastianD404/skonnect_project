ALTER TABLE "grantees"
  ADD COLUMN IF NOT EXISTS "graduatedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "admin_notifications" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "admin_notifications_createdAt_idx"
  ON "admin_notifications" ("createdAt");