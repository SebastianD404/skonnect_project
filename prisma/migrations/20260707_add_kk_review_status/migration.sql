-- Add reviewStatus column to kk_profiling_registrations table
ALTER TABLE "kk_profiling_registrations"
ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'Pending';

-- Create an index on reviewStatus for faster filtering
CREATE INDEX "kk_profiling_registrations_reviewStatus_idx" ON "kk_profiling_registrations"("reviewStatus");
