-- Add editable system-wide integer settings for administrative configuration.
CREATE TABLE IF NOT EXISTS "system_settings" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "system_settings_key_key"
  ON "system_settings" ("key");

INSERT INTO "system_settings" ("id", "key", "value", "updatedAt")
VALUES ('cm_skeap_max_slots', 'SKEAP_MAX_SLOTS', 55, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;