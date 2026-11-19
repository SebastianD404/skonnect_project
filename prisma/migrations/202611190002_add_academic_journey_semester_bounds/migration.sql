ALTER TABLE "grantees"
  ADD COLUMN IF NOT EXISTS "journeyStartAcademicYear" TEXT,
  ADD COLUMN IF NOT EXISTS "journeyStartSemester" INTEGER,
  ADD COLUMN IF NOT EXISTS "journeyEndSemester" INTEGER;
