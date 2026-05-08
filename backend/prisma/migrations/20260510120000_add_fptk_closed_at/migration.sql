-- AlterTable: FPTK.closedAt (schema alignment; optional timestamp when position closed)
ALTER TABLE "fptk" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);
