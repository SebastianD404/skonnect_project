CREATE TYPE "BackupTrigger" AS ENUM ('MANUAL', 'SCHEDULED');
CREATE TYPE "BackupStatus" AS ENUM ('COMPLETED', 'FAILED');

CREATE TABLE "backup_logs" (
  "id" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "trigger" "BackupTrigger" NOT NULL,
  "status" "BackupStatus" NOT NULL,
  "recordCounts" JSONB NOT NULL,
  "fileSizeBytes" INTEGER NOT NULL,
  "checksumSha256" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "backup_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "backup_logs_createdAt_idx" ON "backup_logs"("createdAt" DESC);
CREATE INDEX "backup_logs_status_createdAt_idx" ON "backup_logs"("status", "createdAt" DESC);

ALTER TABLE "backup_logs"
  ADD CONSTRAINT "backup_logs_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
