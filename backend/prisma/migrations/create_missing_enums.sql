-- Create missing enum types
-- These enums are needed for Application, Interview, Document, Offer tables

-- Create ApplicationStatus enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ApplicationStatus') THEN
        CREATE TYPE "ApplicationStatus" AS ENUM (
            'DRAFT',
            'SUBMITTED',
            'SCREENING',
            'PSYCHOMETRIC_TEST',
            'TECHNICAL_TEST',
            'INTERVIEW_SCHEDULED',
            'INTERVIEW_COMPLETED',
            'DOCUMENT_VERIFICATION',
            'OFFER_PROPOSED',
            'OFFER_APPROVED',
            'OFFER_SENT',
            'OFFER_ACCEPTED',
            'OFFER_REJECTED',
            'MEDICAL_CHECKUP_SCHEDULED',
            'MEDICAL_CHECKUP_COMPLETED',
            'CONTRACT_SENT',
            'CONTRACT_SIGNED',
            'ONBOARDING',
            'HIRED',
            'REJECTED',
            'WITHDRAWN'
        );
    END IF;
END $$;

-- Create InterviewType enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InterviewType') THEN
        CREATE TYPE "InterviewType" AS ENUM (
            'PHONE_SCREEN',
            'HR_INTERVIEW',
            'TECHNICAL_INTERVIEW',
            'MANAGERIAL_INTERVIEW',
            'PANEL_INTERVIEW',
            'FINAL_INTERVIEW'
        );
    END IF;
END $$;

-- Create InterviewStatus enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InterviewStatus') THEN
        CREATE TYPE "InterviewStatus" AS ENUM (
            'SCHEDULED',
            'CONFIRMED',
            'COMPLETED',
            'CANCELLED',
            'NO_SHOW',
            'RESCHEDULED'
        );
    END IF;
END $$;

-- Create DocumentType enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocumentType') THEN
        CREATE TYPE "DocumentType" AS ENUM (
            'RESUME',
            'COVER_LETTER',
            'ID_CARD',
            'DIPLOMA',
            'TRANSCRIPT',
            'CERTIFICATE',
            'REFERENCE_LETTER',
            'MEDICAL_REPORT',
            'PHOTO',
            'OTHER'
        );
    END IF;
END $$;

-- Create DocumentVerificationStatus enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocumentVerificationStatus') THEN
        CREATE TYPE "DocumentVerificationStatus" AS ENUM (
            'PENDING',
            'VERIFIED',
            'REJECTED',
            'EXPIRED'
        );
    END IF;
END $$;

-- Create OfferStatus enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OfferStatus') THEN
        CREATE TYPE "OfferStatus" AS ENUM (
            'DRAFT',
            'PENDING_HRBP_REVIEW',
            'PENDING_HEAD_APPROVAL',
            'APPROVED',
            'REJECTED',
            'SENT_TO_CANDIDATE',
            'ACCEPTED',
            'REJECTED_BY_CANDIDATE',
            'NEGOTIATION',
            'EXPIRED'
        );
    END IF;
END $$;

