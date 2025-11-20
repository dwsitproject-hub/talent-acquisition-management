-- Create FPTK table with all required columns
-- This script creates the FPTK table if it doesn't exist

CREATE TABLE IF NOT EXISTS "fptk" (
    "id" TEXT NOT NULL,
    "fptkNumber" TEXT NOT NULL,
    
    -- Basic Information
    "pt" TEXT,
    "noFktk" TEXT,
    "statusFktk" TEXT,
    "division" TEXT,
    "section" TEXT,
    "hiringManager" TEXT,
    "position" TEXT NOT NULL,
    
    -- Position Details
    "positionTitle" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "employmentType" TEXT NOT NULL,
    "typeGrade" TEXT,
    "grade2" TEXT,
    "level" TEXT,
    
    -- Priority
    "priority" TEXT,
    "priorityByMonthYear" TEXT,
    "isPriority" BOOLEAN NOT NULL DEFAULT false,
    
    -- Job Details
    "jobSpecification" TEXT,
    "criteria" TEXT,
    
    -- Location Details
    "area" TEXT,
    "areaDetail" TEXT,
    
    -- Replacement Information
    "additionalOrReplacement" TEXT,
    "replacementName" TEXT,
    "resignReason" TEXT,
    
    -- Request Details
    "totalRequest" INTEGER,
    "currentStatus" TEXT,
    "requestDate" TIMESTAMP(3),
    
    -- Legacy Fields
    "numberOfPositions" INTEGER NOT NULL DEFAULT 1,
    "filledPositions" INTEGER NOT NULL DEFAULT 0,
    "minEducation" TEXT,
    "minExperience" INTEGER,
    "requiredSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "jobDescription" TEXT,
    "responsibilities" TEXT,
    "qualifications" TEXT,
    "salaryRangeMin" DECIMAL(12,2),
    "salaryRangeMax" DECIMAL(12,2),
    "benefits" TEXT,
    "requestedBy" TEXT,
    "status" "FPTKStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "targetStartDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "remark" TEXT,
    
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fptk_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint for fptkNumber
CREATE UNIQUE INDEX IF NOT EXISTS "fptk_fptkNumber_key" ON "fptk"("fptkNumber");

-- Create indexes
CREATE INDEX IF NOT EXISTS "fptk_fptkNumber_idx" ON "fptk"("fptkNumber");
CREATE INDEX IF NOT EXISTS "fptk_status_idx" ON "fptk"("status");
CREATE INDEX IF NOT EXISTS "fptk_department_idx" ON "fptk"("department");
CREATE INDEX IF NOT EXISTS "fptk_division_idx" ON "fptk"("division");
CREATE INDEX IF NOT EXISTS "fptk_priority_idx" ON "fptk"("priority");

-- Create foreign key to users table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fptk_createdBy_fkey'
    ) THEN
        ALTER TABLE "fptk" 
        ADD CONSTRAINT "fptk_createdBy_fkey" 
        FOREIGN KEY ("createdBy") 
        REFERENCES "users"("id") 
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

