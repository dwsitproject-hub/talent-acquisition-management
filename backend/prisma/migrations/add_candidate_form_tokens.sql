-- Create table to store candidate form access tokens
CREATE TABLE IF NOT EXISTS "candidate_form_tokens" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "candidate_form_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "candidate_form_tokens_token_key" ON "candidate_form_tokens"("token");
CREATE INDEX IF NOT EXISTS "candidate_form_tokens_candidateId_idx" ON "candidate_form_tokens"("candidateId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'candidate_form_tokens_candidateId_fkey'
    ) THEN
        ALTER TABLE "candidate_form_tokens"
        ADD CONSTRAINT "candidate_form_tokens_candidateId_fkey"
        FOREIGN KEY ("candidateId")
        REFERENCES "candidates"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

