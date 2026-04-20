-- Add hiringManagerName to master_divisions (idempotent for existing DBs)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'master_divisions'
          AND column_name = 'hiringManagerName'
    ) THEN
        ALTER TABLE "master_divisions" ADD COLUMN "hiringManagerName" TEXT NOT NULL DEFAULT '';
    END IF;
END $$;
