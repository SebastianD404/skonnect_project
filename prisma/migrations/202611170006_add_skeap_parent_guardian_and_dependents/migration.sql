ALTER TABLE "skeap_applications"
  ADD COLUMN IF NOT EXISTS "parentGuardianName" TEXT,
  ADD COLUMN IF NOT EXISTS "parentGuardianContact" TEXT,
  ADD COLUMN IF NOT EXISTS "numberOfDependents" INTEGER;
