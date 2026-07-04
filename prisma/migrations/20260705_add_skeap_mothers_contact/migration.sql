DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='skeap_applications' AND column_name='mothersContact'
  ) THEN
    ALTER TABLE "skeap_applications" ADD COLUMN "mothersContact" TEXT;
  END IF;
END $$;
