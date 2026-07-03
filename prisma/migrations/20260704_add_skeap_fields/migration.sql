DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='skeap_applications' AND column_name='applicantName'
  ) THEN
    ALTER TABLE "skeap_applications" ADD COLUMN "applicantName" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='skeap_applications' AND column_name='permanentAddress'
  ) THEN
    ALTER TABLE "skeap_applications" ADD COLUMN "permanentAddress" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='skeap_applications' AND column_name='dateOfBirth'
  ) THEN
    ALTER TABLE "skeap_applications" ADD COLUMN "dateOfBirth" TIMESTAMP(3);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='skeap_applications' AND column_name='placeOfBirth'
  ) THEN
    ALTER TABLE "skeap_applications" ADD COLUMN "placeOfBirth" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='skeap_applications' AND column_name='fathersName'
  ) THEN
    ALTER TABLE "skeap_applications" ADD COLUMN "fathersName" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='skeap_applications' AND column_name='fathersOccupation'
  ) THEN
    ALTER TABLE "skeap_applications" ADD COLUMN "fathersOccupation" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='skeap_applications' AND column_name='fathersContact'
  ) THEN
    ALTER TABLE "skeap_applications" ADD COLUMN "fathersContact" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='skeap_applications' AND column_name='mothersMaidenName'
  ) THEN
    ALTER TABLE "skeap_applications" ADD COLUMN "mothersMaidenName" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='skeap_applications' AND column_name='mothersOccupation'
  ) THEN
    ALTER TABLE "skeap_applications" ADD COLUMN "mothersOccupation" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='skeap_applications' AND column_name='contactNumber'
  ) THEN
    ALTER TABLE "skeap_applications" ADD COLUMN "contactNumber" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='skeap_applications' AND column_name='emailAddress'
  ) THEN
    ALTER TABLE "skeap_applications" ADD COLUMN "emailAddress" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='skeap_applications' AND column_name='uploadedFiles'
  ) THEN
    ALTER TABLE "skeap_applications" ADD COLUMN "uploadedFiles" JSONB;
  END IF;
END $$;
