-- Add pt, area, areaDetail fields to users table for HRBP role
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pt" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "area" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "areaDetail" TEXT;

