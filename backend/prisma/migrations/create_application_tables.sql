-- Create Application and related tables (ApplicationStatusHistory, Test, Interview, InterviewFeedback, Document, Offer)

-- Create Application table
CREATE TABLE IF NOT EXISTS "applications" (
    "id" TEXT NOT NULL,
    "applicationNumber" TEXT NOT NULL UNIQUE,
    "candidateId" TEXT NOT NULL,
    "fptkId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "currentStage" INTEGER NOT NULL DEFAULT 1,
    "source" TEXT,
    "referredBy" TEXT,
    "appliedByUserId" TEXT,
    "aiMatchScore" DOUBLE PRECISION,
    "screeningScore" DOUBLE PRECISION,
    "technicalScore" DOUBLE PRECISION,
    "interviewScore" DOUBLE PRECISION,
    "overallScore" DOUBLE PRECISION,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "screenedAt" TIMESTAMP(3),
    "interviewedAt" TIMESTAMP(3),
    "offeredAt" TIMESTAMP(3),
    "hiredAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "slaBreached" BOOLEAN NOT NULL DEFAULT false,
    "slaDaysElapsed" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "applications_applicationNumber_key" ON "applications"("applicationNumber");
CREATE INDEX IF NOT EXISTS "applications_candidateId_idx" ON "applications"("candidateId");
CREATE INDEX IF NOT EXISTS "applications_fptkId_idx" ON "applications"("fptkId");
CREATE INDEX IF NOT EXISTS "applications_status_idx" ON "applications"("status");
CREATE INDEX IF NOT EXISTS "applications_appliedAt_idx" ON "applications"("appliedAt");

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'applications_candidateId_fkey'
    ) THEN
        ALTER TABLE "applications" 
        ADD CONSTRAINT "applications_candidateId_fkey" 
        FOREIGN KEY ("candidateId") 
        REFERENCES "candidates"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'applications_fptkId_fkey'
    ) THEN
        ALTER TABLE "applications" 
        ADD CONSTRAINT "applications_fptkId_fkey" 
        FOREIGN KEY ("fptkId") 
        REFERENCES "fptk"("id") 
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'applications_appliedByUserId_fkey'
    ) THEN
        ALTER TABLE "applications" 
        ADD CONSTRAINT "applications_appliedByUserId_fkey" 
        FOREIGN KEY ("appliedByUserId") 
        REFERENCES "users"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Create ApplicationStatusHistory table
CREATE TABLE IF NOT EXISTS "application_status_history" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fromStatus" "ApplicationStatus",
    "toStatus" "ApplicationStatus" NOT NULL,
    "changedBy" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_status_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "application_status_history_applicationId_idx" ON "application_status_history"("applicationId");
CREATE INDEX IF NOT EXISTS "application_status_history_createdAt_idx" ON "application_status_history"("createdAt");

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'application_status_history_applicationId_fkey'
    ) THEN
        ALTER TABLE "application_status_history" 
        ADD CONSTRAINT "application_status_history_applicationId_fkey" 
        FOREIGN KEY ("applicationId") 
        REFERENCES "applications"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Create Test table
CREATE TABLE IF NOT EXISTS "tests" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "testType" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "provider" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "score" DOUBLE PRECISION,
    "maxScore" DOUBLE PRECISION,
    "percentile" DOUBLE PRECISION,
    "passed" BOOLEAN,
    "testUrl" TEXT,
    "resultUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tests_applicationId_idx" ON "tests"("applicationId");

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'tests_applicationId_fkey'
    ) THEN
        ALTER TABLE "tests" 
        ADD CONSTRAINT "tests_applicationId_fkey" 
        FOREIGN KEY ("applicationId") 
        REFERENCES "applications"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Create Interview table
CREATE TABLE IF NOT EXISTS "interviews" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "interviewType" "InterviewType" NOT NULL,
    "status" "InterviewStatus" NOT NULL DEFAULT 'SCHEDULED',
    "round" INTEGER NOT NULL DEFAULT 1,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL,
    "location" TEXT,
    "meetingLink" TEXT,
    "meetingPassword" TEXT,
    "interviewerId" TEXT,
    "panelMembers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "interviews_applicationId_idx" ON "interviews"("applicationId");
CREATE INDEX IF NOT EXISTS "interviews_candidateId_idx" ON "interviews"("candidateId");
CREATE INDEX IF NOT EXISTS "interviews_interviewerId_idx" ON "interviews"("interviewerId");
CREATE INDEX IF NOT EXISTS "interviews_scheduledAt_idx" ON "interviews"("scheduledAt");

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'interviews_applicationId_fkey'
    ) THEN
        ALTER TABLE "interviews" 
        ADD CONSTRAINT "interviews_applicationId_fkey" 
        FOREIGN KEY ("applicationId") 
        REFERENCES "applications"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'interviews_candidateId_fkey'
    ) THEN
        ALTER TABLE "interviews" 
        ADD CONSTRAINT "interviews_candidateId_fkey" 
        FOREIGN KEY ("candidateId") 
        REFERENCES "candidates"("id") 
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'interviews_interviewerId_fkey'
    ) THEN
        ALTER TABLE "interviews" 
        ADD CONSTRAINT "interviews_interviewerId_fkey" 
        FOREIGN KEY ("interviewerId") 
        REFERENCES "users"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Create InterviewFeedback table
CREATE TABLE IF NOT EXISTS "interview_feedback" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "interviewerId" TEXT NOT NULL,
    "technicalSkills" INTEGER,
    "communication" INTEGER,
    "problemSolving" INTEGER,
    "cultureFit" INTEGER,
    "overallRating" INTEGER,
    "strengths" TEXT,
    "weaknesses" TEXT,
    "recommendation" TEXT NOT NULL,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "interview_feedback_interviewId_idx" ON "interview_feedback"("interviewId");
CREATE INDEX IF NOT EXISTS "interview_feedback_interviewerId_idx" ON "interview_feedback"("interviewerId");

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'interview_feedback_interviewId_fkey'
    ) THEN
        ALTER TABLE "interview_feedback" 
        ADD CONSTRAINT "interview_feedback_interviewId_fkey" 
        FOREIGN KEY ("interviewId") 
        REFERENCES "interviews"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'interview_feedback_interviewerId_fkey'
    ) THEN
        ALTER TABLE "interview_feedback" 
        ADD CONSTRAINT "interview_feedback_interviewerId_fkey" 
        FOREIGN KEY ("interviewerId") 
        REFERENCES "users"("id") 
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- Create Document table
CREATE TABLE IF NOT EXISTS "documents" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT,
    "applicationId" TEXT,
    "documentType" "DocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "verificationStatus" "DocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verificationNotes" TEXT,
    "expiryDate" TIMESTAMP(3),
    "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
    "virusScanned" BOOLEAN NOT NULL DEFAULT false,
    "scanResult" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "documents_candidateId_idx" ON "documents"("candidateId");
CREATE INDEX IF NOT EXISTS "documents_applicationId_idx" ON "documents"("applicationId");
CREATE INDEX IF NOT EXISTS "documents_documentType_idx" ON "documents"("documentType");

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'documents_candidateId_fkey'
    ) THEN
        ALTER TABLE "documents" 
        ADD CONSTRAINT "documents_candidateId_fkey" 
        FOREIGN KEY ("candidateId") 
        REFERENCES "candidates"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'documents_applicationId_fkey'
    ) THEN
        ALTER TABLE "documents" 
        ADD CONSTRAINT "documents_applicationId_fkey" 
        FOREIGN KEY ("applicationId") 
        REFERENCES "applications"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Create Offer table
CREATE TABLE IF NOT EXISTS "offers" (
    "id" TEXT NOT NULL,
    "offerNumber" TEXT NOT NULL UNIQUE,
    "applicationId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'DRAFT',
    "jobTitle" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "basicSalary" DECIMAL(12,2) NOT NULL,
    "allowances" JSONB,
    "bonusStructure" TEXT,
    "totalPackage" DECIMAL(12,2) NOT NULL,
    "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "employmentType" TEXT NOT NULL,
    "contractDuration" INTEGER,
    "probationPeriod" INTEGER,
    "noticePeriod" INTEGER,
    "createdBy" TEXT NOT NULL,
    "hrbpReviewedBy" TEXT,
    "hrbpReviewedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "sentToCandidate" TIMESTAMP(3),
    "viewedByCandidate" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "candidateResponse" TEXT,
    "counterOffer" DECIMAL(12,2),
    "negotiationNotes" TEXT,
    "offerLetterUrl" TEXT,
    "contractUrl" TEXT,
    "signedContractUrl" TEXT,
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "offers_offerNumber_key" ON "offers"("offerNumber");
CREATE INDEX IF NOT EXISTS "offers_applicationId_idx" ON "offers"("applicationId");
CREATE INDEX IF NOT EXISTS "offers_candidateId_idx" ON "offers"("candidateId");
CREATE INDEX IF NOT EXISTS "offers_status_idx" ON "offers"("status");

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'offers_applicationId_fkey'
    ) THEN
        ALTER TABLE "offers" 
        ADD CONSTRAINT "offers_applicationId_fkey" 
        FOREIGN KEY ("applicationId") 
        REFERENCES "applications"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'offers_candidateId_fkey'
    ) THEN
        ALTER TABLE "offers" 
        ADD CONSTRAINT "offers_candidateId_fkey" 
        FOREIGN KEY ("candidateId") 
        REFERENCES "candidates"("id") 
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'offers_createdBy_fkey'
    ) THEN
        ALTER TABLE "offers" 
        ADD CONSTRAINT "offers_createdBy_fkey" 
        FOREIGN KEY ("createdBy") 
        REFERENCES "users"("id") 
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'offers_approvedBy_fkey'
    ) THEN
        ALTER TABLE "offers" 
        ADD CONSTRAINT "offers_approvedBy_fkey" 
        FOREIGN KEY ("approvedBy") 
        REFERENCES "users"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

