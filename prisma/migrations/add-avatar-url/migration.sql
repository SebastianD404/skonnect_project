-- Migration: add-avatar-url
-- Adds nullable avatarUrl column to users table so Prisma schema matches DB

ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT NULL;
