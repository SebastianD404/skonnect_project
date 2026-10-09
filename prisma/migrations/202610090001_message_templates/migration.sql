CREATE TYPE "MessageTemplateType" AS ENUM ('DEADLINE_REMINDER', 'PAYOUT_ASSEMBLY');
CREATE TYPE "MessageTemplateChannel" AS ENUM ('EMAIL', 'SMS');

CREATE TABLE "message_templates" (
  "id" TEXT NOT NULL,
  "type" "MessageTemplateType" NOT NULL,
  "channel" "MessageTemplateChannel" NOT NULL,
  "subject" TEXT NOT NULL DEFAULT '',
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "message_templates_type_channel_key"
  ON "message_templates"("type", "channel");

INSERT INTO "message_templates" ("id", "type", "channel", "subject", "body", "updatedAt")
VALUES
  (
    gen_random_uuid()::text,
    'DEADLINE_REMINDER',
    'EMAIL',
    'SKEAP submission deadline reminder',
    'The submission deadline is {{deadline_date}} at {{deadline_time}}. Please complete your requirements for {{current_semester}} before the cutoff.',
    CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid()::text,
    'DEADLINE_REMINDER',
    'SMS',
    '',
    'Reminder: SKEAP requirements for {{current_semester}} are due {{deadline_date}} at {{deadline_time}}.',
    CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid()::text,
    'PAYOUT_ASSEMBLY',
    'EMAIL',
    'SKEAP payout assembly notice',
    'Please attend the payout assembly for {{current_semester}}. Previous semester: {{last_semester}}.',
    CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid()::text,
    'PAYOUT_ASSEMBLY',
    'SMS',
    '',
    'SKEAP payout assembly for {{current_semester}}. Previous semester: {{last_semester}}.',
    CURRENT_TIMESTAMP
  );
