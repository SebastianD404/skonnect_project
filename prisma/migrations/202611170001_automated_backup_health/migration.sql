ALTER TYPE "BackupTrigger" ADD VALUE IF NOT EXISTS 'AUTOMATED';

ALTER TABLE "backup_logs"
  ADD COLUMN "storagePath" TEXT,
  ADD COLUMN "createdByLabel" TEXT,
  ADD COLUMN "errorMessage" TEXT;
