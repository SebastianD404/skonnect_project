-- Create reminder settings and reminder history tables for automated deadline notifications.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReminderType') THEN
    CREATE TYPE "ReminderType" AS ENUM ('SKEAP_APPLICATION', 'EVENT_REGISTRATION');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "reminder_settings" (
  "id" TEXT PRIMARY KEY,
  "type" "ReminderType" NOT NULL UNIQUE,
  "offsets" INTEGER[] NOT NULL DEFAULT '{}',
  "deadline" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "reminder_logs" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "reminderType" "ReminderType" NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "triggerDate" TIMESTAMP(3) NOT NULL,
  "channel" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "success" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  CONSTRAINT "reminder_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);
