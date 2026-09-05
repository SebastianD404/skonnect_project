CREATE TABLE IF NOT EXISTS "grantee_messages" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "senderId" TEXT,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "grantee_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "grantee_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "grantee_messages_userId_createdAt_idx"
  ON "grantee_messages" ("userId", "createdAt" DESC);