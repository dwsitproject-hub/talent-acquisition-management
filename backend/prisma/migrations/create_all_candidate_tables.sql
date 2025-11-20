-- Create all candidate-related tables
-- This script creates Candidate, Education, WorkExperience, Certification, Reference, Application, Interview, Offer, Document tables

-- Create Candidate table
CREATE TABLE IF NOT EXISTS "candidates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL UNIQUE,
    "nationalId" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "placeOfBirth" TEXT,
    "gender" TEXT,
    "maritalStatus" TEXT,
    "nationality" TEXT,
    "religion" TEXT,
    "bloodType" TEXT,
    "height" INTEGER,
    "weight" INTEGER,
    "npwpNumber" TEXT,
    "bpjsJhtNumber" TEXT,
    "bpjsHealthNumber" TEXT,
    "bpjsPensionNumber" TEXT,
    "currentAddress" TEXT,
    "permanentAddress" TEXT,
    "emergencyContact" TEXT,
    "emergencyPhone" TEXT,
    "emergencyRelation" TEXT,
    "currentJobTitle" TEXT,
    "currentCompany" TEXT,
    "currentSalary" DECIMAL(12,2),
    "expectedSalary" DECIMAL(12,2),
    "noticePeriod" INTEGER,
    "availableFrom" TIMESTAMP(3),
    "drivingLicense" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "languages" JSONB,
    "linkedinUrl" TEXT,
    "portfolioUrl" TEXT,
    "overallScore" DOUBLE PRECISION DEFAULT 0,
    "aiMatchScore" JSONB,
    "gdprConsent" BOOLEAN NOT NULL DEFAULT false,
    "gdprConsentDate" TIMESTAMP(3),
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- Create unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "candidates_userId_key" ON "candidates"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "candidates_nationalId_key" ON "candidates"("nationalId") WHERE "nationalId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "candidates_npwpNumber_key" ON "candidates"("npwpNumber") WHERE "npwpNumber" IS NOT NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS "candidates_userId_idx" ON "candidates"("userId");
CREATE INDEX IF NOT EXISTS "candidates_nationalId_idx" ON "candidates"("nationalId") WHERE "nationalId" IS NOT NULL;

-- Create foreign key
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'candidates_userId_fkey'
    ) THEN
        ALTER TABLE "candidates" 
        ADD CONSTRAINT "candidates_userId_fkey" 
        FOREIGN KEY ("userId") 
        REFERENCES "users"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Create Education table
CREATE TABLE IF NOT EXISTS "educations" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "fieldOfStudy" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "grade" TEXT,
    "location" TEXT,
    "achievements" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "educations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "educations_candidateId_idx" ON "educations"("candidateId");

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'educations_candidateId_fkey'
    ) THEN
        ALTER TABLE "educations" 
        ADD CONSTRAINT "educations_candidateId_fkey" 
        FOREIGN KEY ("candidateId") 
        REFERENCES "candidates"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Create WorkExperience table
CREATE TABLE IF NOT EXISTS "work_experiences" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "responsibilities" TEXT,
    "achievements" TEXT,
    "reasonForLeaving" TEXT,
    "startingSalary" DECIMAL(12,2),
    "endingSalary" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_experiences_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "work_experiences_candidateId_idx" ON "work_experiences"("candidateId");

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'work_experiences_candidateId_fkey'
    ) THEN
        ALTER TABLE "work_experiences" 
        ADD CONSTRAINT "work_experiences_candidateId_fkey" 
        FOREIGN KEY ("candidateId") 
        REFERENCES "candidates"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Create Certification table
CREATE TABLE IF NOT EXISTS "certifications" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuingOrg" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "credentialId" TEXT,
    "credentialUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "certifications_candidateId_idx" ON "certifications"("candidateId");

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'certifications_candidateId_fkey'
    ) THEN
        ALTER TABLE "certifications" 
        ADD CONSTRAINT "certifications_candidateId_fkey" 
        FOREIGN KEY ("candidateId") 
        REFERENCES "candidates"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Create Reference table
CREATE TABLE IF NOT EXISTS "references" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "position" TEXT,
    "relationship" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "isContactAllowed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "references_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "references_candidateId_idx" ON "references"("candidateId");

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'references_candidateId_fkey'
    ) THEN
        ALTER TABLE "references" 
        ADD CONSTRAINT "references_candidateId_fkey" 
        FOREIGN KEY ("candidateId") 
        REFERENCES "candidates"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

