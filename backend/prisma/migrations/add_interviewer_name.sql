-- Add interviewerName column to interviews table
ALTER TABLE "interviews" ADD COLUMN IF NOT EXISTS "interviewerName" TEXT;

