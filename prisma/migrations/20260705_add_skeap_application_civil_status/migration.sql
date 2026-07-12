DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'skeap_applications') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'skeap_applications' AND column_name = 'civilStatus'
    ) THEN
      ALTER TABLE "skeap_applications" ADD COLUMN "civilStatus" TEXT;
    END IF;
  END IF;
END $$;
