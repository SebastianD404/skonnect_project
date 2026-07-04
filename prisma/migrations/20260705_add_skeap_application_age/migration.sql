DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skeap_applications' AND column_name = 'age'
  ) THEN
    ALTER TABLE "skeap_applications" ADD COLUMN "age" INTEGER;
  END IF;
END $$;
