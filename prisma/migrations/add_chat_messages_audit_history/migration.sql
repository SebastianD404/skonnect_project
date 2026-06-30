-- Migration: add_chat_messages_audit_history
-- Adds persisted per-user chat messages for multilingual assistant history.

DO $$
BEGIN
  CREATE TYPE "ChatMessageRole" AS ENUM ('USER', 'ASSISTANT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "ChatMessageRole" NOT NULL,
  "content" TEXT NOT NULL,
  "language" "Language" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "chat_messages_userId_createdAt_idx"
ON "chat_messages"("userId", "createdAt" DESC);
