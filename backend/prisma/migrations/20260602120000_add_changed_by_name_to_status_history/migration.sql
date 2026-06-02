-- Migration: Add changedByName to application_status_history
-- Records the display name of who made each status change for audit trail purposes

ALTER TABLE "application_status_history" ADD COLUMN "changedByName" TEXT;
