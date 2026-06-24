-- Add TA_SITE value to UserRole enum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'TA_SITE';
