-- Add non-Pico event group policy columns to the events table if they are missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'events'
      AND column_name = 'allowNonPico'
  ) THEN
    ALTER TABLE "events" ADD COLUMN "allowNonPico" BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'events'
      AND column_name = 'nonPicoLimit'
  ) THEN
    ALTER TABLE "events" ADD COLUMN "nonPicoLimit" INTEGER NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'events'
      AND column_name = 'minPicoMembers'
  ) THEN
    ALTER TABLE "events" ADD COLUMN "minPicoMembers" INTEGER NOT NULL DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'events'
      AND column_name = 'nonPicoPolicyNote'
  ) THEN
    ALTER TABLE "events" ADD COLUMN "nonPicoPolicyNote" TEXT;
  END IF;
END $$;
