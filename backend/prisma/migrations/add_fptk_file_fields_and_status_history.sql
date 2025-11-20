-- Add FPTK file fields and status history table
-- This migration adds file upload support and status milestone tracking

-- Add FPTK file fields to existing fptk table
DO $$ 
BEGIN
    -- Add fptkFilePath if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fptk' AND column_name = 'fptkFilePath'
    ) THEN
        ALTER TABLE "fptk" ADD COLUMN "fptkFilePath" TEXT;
    END IF;

    -- Add fptkFileName if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fptk' AND column_name = 'fptkFileName'
    ) THEN
        ALTER TABLE "fptk" ADD COLUMN "fptkFileName" TEXT;
    END IF;

    -- Add fptkReceiveDate if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fptk' AND column_name = 'fptkReceiveDate'
    ) THEN
        ALTER TABLE "fptk" ADD COLUMN "fptkReceiveDate" TIMESTAMP(3);
    END IF;
END $$;

-- Create FPTKStatusHistory table if it doesn't exist
CREATE TABLE IF NOT EXISTS "fptk_status_history" (
    "id" TEXT NOT NULL,
    "fptkId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "changedBy" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fptk_status_history_pkey" PRIMARY KEY ("id")
);

-- Create indexes for fptk_status_history
CREATE INDEX IF NOT EXISTS "fptk_status_history_fptkId_idx" ON "fptk_status_history"("fptkId");
CREATE INDEX IF NOT EXISTS "fptk_status_history_toStatus_idx" ON "fptk_status_history"("toStatus");
CREATE INDEX IF NOT EXISTS "fptk_status_history_createdAt_idx" ON "fptk_status_history"("createdAt");

-- Create foreign key constraint if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fptk_status_history_fptkId_fkey'
    ) THEN
        ALTER TABLE "fptk_status_history" 
        ADD CONSTRAINT "fptk_status_history_fptkId_fkey" 
        FOREIGN KEY ("fptkId") 
        REFERENCES "fptk"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Create trigger to update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_fptk_status_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_fptk_status_history_updated_at ON "fptk_status_history";
CREATE TRIGGER update_fptk_status_history_updated_at
    BEFORE UPDATE ON "fptk_status_history"
    FOR EACH ROW
    EXECUTE FUNCTION update_fptk_status_history_updated_at();

