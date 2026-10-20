DO $$
BEGIN
  -- Create enum type if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'eventallowedtype'
  ) THEN
    CREATE TYPE "EventAllowedType" AS ENUM ('SOLO_ONLY', 'GROUP_ONLY', 'BOTH');
  END IF;

  -- Add column to events table if missing, with safe default
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'allowedType'
  ) THEN
    ALTER TABLE "events" ADD COLUMN "allowedType" "EventAllowedType" NOT NULL DEFAULT 'BOTH';
  END IF;
END $$;
