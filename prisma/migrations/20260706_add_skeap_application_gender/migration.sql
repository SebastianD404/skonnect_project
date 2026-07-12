DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'skeap_applications') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'skeap_applications' AND column_name = 'gender'
    ) THEN
      ALTER TABLE "skeap_applications" ADD COLUMN "gender" TEXT;
    END IF;
  END IF;
END $$;
