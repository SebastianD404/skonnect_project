-- Create the KK profiling registrations table used by the app.
CREATE TABLE IF NOT EXISTS "kk_profiling_registrations" (
  "id" TEXT NOT NULL,
  "program" TEXT NOT NULL DEFAULT 'KK',
  "userId" TEXT,
  "fullName" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "sex" TEXT NOT NULL,
  "age" INTEGER NOT NULL,
  "birthDate" TIMESTAMP(3) NOT NULL,
  "email" TEXT NOT NULL,
  "facebook" TEXT NOT NULL,
  "contactNumber" TEXT NOT NULL,
  "civilStatus" TEXT NOT NULL,
  "youthClassification" TEXT NOT NULL,
  "youthAgeGroup" TEXT NOT NULL,
  "workStatus" TEXT NOT NULL,
  "educationalBackground" TEXT NOT NULL,
  "registeredSKVoter" TEXT NOT NULL,
  "votedLastSK" TEXT NOT NULL,
  "registeredNationalVoter" TEXT NOT NULL,
  "attendedKKAssembly" TEXT NOT NULL,
  "assemblyTimes" TEXT,
  "noAssemblyReason" TEXT,
  "consent" BOOLEAN NOT NULL DEFAULT true,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kk_profiling_registrations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "kk_profiling_registrations"
  ADD COLUMN IF NOT EXISTS "userId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'kk_profiling_registrations_userId_fkey'
  ) THEN
    ALTER TABLE "kk_profiling_registrations"
      ADD CONSTRAINT "kk_profiling_registrations_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
