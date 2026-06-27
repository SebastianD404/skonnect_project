-- Migration: add_user_settings
-- Adds nullable settings column to users table to match Prisma schema

ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "settings" JSONB;
