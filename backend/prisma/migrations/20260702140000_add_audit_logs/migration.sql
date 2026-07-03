-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AuditAction" AS ENUM (
    'CREATE',
    'READ',
    'UPDATE',
    'DELETE',
    'LOGIN',
    'LOGOUT',
    'APPROVE',
    'REJECT',
    'EXPORT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "action" "AuditAction" NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT,
  "oldValues" JSONB,
  "newValues" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_userId_idx" ON "audit_logs"("userId");
CREATE INDEX IF NOT EXISTS "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");
CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "audit_logs"
    ADD CONSTRAINT "audit_logs_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Seed Audit Trail menu access (SUPER_ADMIN only)
INSERT INTO menu_access (id, "menuPath", "menuLabel", "visibleRoles", "createRoles", "editRoles", "createdAt", "updatedAt")
SELECT gen_random_uuid(),
  '/audit-trail',
  'Audit Trail',
  ARRAY['SUPER_ADMIN']::TEXT[],
  ARRAY[]::TEXT[],
  ARRAY[]::TEXT[],
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM menu_access WHERE "menuPath" = '/audit-trail');
