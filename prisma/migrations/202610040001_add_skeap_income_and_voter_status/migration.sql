ALTER TABLE "skeap_applications"
  ADD COLUMN IF NOT EXISTS "registeredVoter" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "totalFamilyMonthlyIncome" TEXT;
