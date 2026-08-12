ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "requestId" TEXT;
CREATE INDEX IF NOT EXISTS "audit_logs_requestId_idx" ON "audit_logs"("requestId");
