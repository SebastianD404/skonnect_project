ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "username" TEXT,
  ADD COLUMN IF NOT EXISTS "mustSecureAccount" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "usesTemporaryPassword" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "kkProfileId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "users_kkProfileId_key" ON "users"("kkProfileId");

CREATE TABLE IF NOT EXISTS "kk_profiles" (
  "id" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "middleName" TEXT,
  "lastName" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "purok" TEXT NOT NULL,
  "addressLine" TEXT NOT NULL,
  "barangay" TEXT NOT NULL DEFAULT 'Pico',
  "birthDate" TIMESTAMP(3) NOT NULL,
  "contactNumber" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "isVerified" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kk_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "kk_profiles_email_key" ON "kk_profiles"("email");
CREATE INDEX IF NOT EXISTS "kk_profiles_lastName_firstName_idx" ON "kk_profiles"("lastName", "firstName");

CREATE TABLE IF NOT EXISTS "skeap_applications" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "currentCourse" TEXT NOT NULL,
  "yearLevel" TEXT NOT NULL,
  "gwa" DECIMAL(4, 2),
  "enrollmentFileUrl" TEXT NOT NULL,
  "reportCardFileUrl" TEXT NOT NULL,
  "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "skeap_applications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "skeap_applications_userId_submittedAt_idx" ON "skeap_applications"("userId", "submittedAt" DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_kkProfileId_fkey'
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_kkProfileId_fkey"
      FOREIGN KEY ("kkProfileId") REFERENCES "kk_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'skeap_applications_userId_fkey'
  ) THEN
    ALTER TABLE "skeap_applications"
      ADD CONSTRAINT "skeap_applications_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
