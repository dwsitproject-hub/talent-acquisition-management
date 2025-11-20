-- Manual migration to add Master tables and update FPTK table
-- Run this inside the backend container: docker-compose exec backend psql $DATABASE_URL -f prisma/migrations/manual_add_master_tables.sql

-- Create Master Division table
CREATE TABLE IF NOT EXISTS "master_divisions" (
    "id" TEXT NOT NULL,
    "divisionName" TEXT NOT NULL,
    "sectionName" TEXT NOT NULL,
    "headOfDivisionName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_divisions_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint for division and section
CREATE UNIQUE INDEX IF NOT EXISTS "master_divisions_divisionName_sectionName_key" ON "master_divisions"("divisionName", "sectionName");

-- Create index for division name
CREATE INDEX IF NOT EXISTS "master_divisions_divisionName_idx" ON "master_divisions"("divisionName");

-- Create Master Office Location table
CREATE TABLE IF NOT EXISTS "master_office_locations" (
    "id" TEXT NOT NULL,
    "pt" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "areaDetail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_office_locations_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint for pt, area, and areaDetail
CREATE UNIQUE INDEX IF NOT EXISTS "master_office_locations_pt_area_areaDetail_key" ON "master_office_locations"("pt", "area", "areaDetail");

-- Create indexes
CREATE INDEX IF NOT EXISTS "master_office_locations_pt_idx" ON "master_office_locations"("pt");
CREATE INDEX IF NOT EXISTS "master_office_locations_area_idx" ON "master_office_locations"("area");

-- Add new columns to FPTK table (if they don't exist)
DO $$ 
BEGIN
    -- Add PT column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fptk' AND column_name = 'pt') THEN
        ALTER TABLE "fptk" ADD COLUMN "pt" TEXT;
    END IF;

    -- Add No FKTK column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fptk' AND column_name = 'noFktk') THEN
        ALTER TABLE "fptk" ADD COLUMN "noFktk" TEXT;
    END IF;

    -- Add Status FKTK column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fptk' AND column_name = 'statusFktk') THEN
        ALTER TABLE "fptk" ADD COLUMN "statusFktk" TEXT;
    END IF;

    -- Add Section column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fptk' AND column_name = 'section') THEN
        ALTER TABLE "fptk" ADD COLUMN "section" TEXT;
    END IF;

    -- Add Hiring Manager column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fptk' AND column_name = 'hiringManager') THEN
        ALTER TABLE "fptk" ADD COLUMN "hiringManager" TEXT;
    END IF;

    -- Add Position column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fptk' AND column_name = 'position') THEN
        ALTER TABLE "fptk" ADD COLUMN "position" TEXT;
    END IF;

    -- Add Type Grade column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fptk' AND column_name = 'typeGrade') THEN
        ALTER TABLE "fptk" ADD COLUMN "typeGrade" TEXT;
    END IF;

    -- Add Grade2 column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fptk' AND column_name = 'grade2') THEN
        ALTER TABLE "fptk" ADD COLUMN "grade2" TEXT;
    END IF;

    -- Add Priority column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fptk' AND column_name = 'priority') THEN
        ALTER TABLE "fptk" ADD COLUMN "priority" TEXT;
    END IF;

    -- Add Priority by Month-Year column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fptk' AND column_name = 'priorityByMonthYear') THEN
        ALTER TABLE "fptk" ADD COLUMN "priorityByMonthYear" TEXT;
    END IF;

    -- Add Job Specification column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fptk' AND column_name = 'jobSpecification') THEN
        ALTER TABLE "fptk" ADD COLUMN "jobSpecification" TEXT;
    END IF;

    -- Add Criteria column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fptk' AND column_name = 'criteria') THEN
        ALTER TABLE "fptk" ADD COLUMN "criteria" TEXT;
    END IF;

    -- Add Area column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fptk' AND column_name = 'area') THEN
        ALTER TABLE "fptk" ADD COLUMN "area" TEXT;
    END IF;

    -- Add Area Detail column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fptk' AND column_name = 'areaDetail') THEN
        ALTER TABLE "fptk" ADD COLUMN "areaDetail" TEXT;
    END IF;

    -- Add Additional or Replacement column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fptk' AND column_name = 'additionalOrReplacement') THEN
        ALTER TABLE "fptk" ADD COLUMN "additionalOrReplacement" TEXT;
    END IF;

    -- Add Replacement Name column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fptk' AND column_name = 'replacementName') THEN
        ALTER TABLE "fptk" ADD COLUMN "replacementName" TEXT;
    END IF;

    -- Add Resign Reason column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fptk' AND column_name = 'resignReason') THEN
        ALTER TABLE "fptk" ADD COLUMN "resignReason" TEXT;
    END IF;

    -- Add Total Request column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fptk' AND column_name = 'totalRequest') THEN
        ALTER TABLE "fptk" ADD COLUMN "totalRequest" INTEGER;
    END IF;

    -- Add Current Status column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fptk' AND column_name = 'currentStatus') THEN
        ALTER TABLE "fptk" ADD COLUMN "currentStatus" TEXT;
    END IF;

    -- Add Request Date column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fptk' AND column_name = 'requestDate') THEN
        ALTER TABLE "fptk" ADD COLUMN "requestDate" TIMESTAMP(3);
    END IF;

    -- Add Remark column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fptk' AND column_name = 'remark') THEN
        ALTER TABLE "fptk" ADD COLUMN "remark" TEXT;
    END IF;
END $$;

-- Create indexes for new FPTK columns
CREATE INDEX IF NOT EXISTS "fptk_division_idx" ON "fptk"("division");
CREATE INDEX IF NOT EXISTS "fptk_priority_idx" ON "fptk"("priority");

