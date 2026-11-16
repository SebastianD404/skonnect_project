ALTER TABLE "kk_profiles"
ADD COLUMN IF NOT EXISTS "guardianOrEmergencyName" TEXT,
ADD COLUMN IF NOT EXISTS "guardianRelationship" TEXT,
ADD COLUMN IF NOT EXISTS "guardianContactNumber" TEXT;
