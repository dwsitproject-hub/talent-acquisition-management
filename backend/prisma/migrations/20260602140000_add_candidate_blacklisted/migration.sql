-- Add blacklisted flag and blacklistReason to candidates table
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "blacklisted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "blacklistReason" TEXT;
