-- Create menu_access table for Menu Access Management
CREATE TABLE IF NOT EXISTS "menu_access" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "menuPath" TEXT NOT NULL UNIQUE,
  "menuLabel" TEXT NOT NULL,
  "visibleRoles" TEXT[] NOT NULL DEFAULT '{}',
  "createRoles" TEXT[] NOT NULL DEFAULT '{}',
  "editRoles" TEXT[] NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedBy" TEXT,
  CONSTRAINT "menu_access_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create index on menuPath
CREATE INDEX IF NOT EXISTS "menu_access_menuPath_idx" ON "menu_access"("menuPath");

-- Insert default menu access configurations
INSERT INTO "menu_access" ("id", "menuPath", "menuLabel", "visibleRoles", "createRoles", "editRoles", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), '/', 'Dashboard', ARRAY['SUPER_ADMIN','Management','Head of Division','HRBP','TA_TEAM','HIRING_MANAGER'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], NOW(), NOW()),
  (gen_random_uuid(), '/fptk', 'Position', ARRAY['SUPER_ADMIN','Management','Head of Division','HRBP','TA_TEAM','HIRING_MANAGER'], ARRAY['SUPER_ADMIN','TA_TEAM','HIRING_MANAGER'], ARRAY['SUPER_ADMIN','Head of Division','HRBP','TA_TEAM','HIRING_MANAGER'], NOW(), NOW()),
  (gen_random_uuid(), '/candidates', 'Candidates', ARRAY['SUPER_ADMIN','Management','Head of Division','HRBP','TA_TEAM'], ARRAY['SUPER_ADMIN','HRBP','TA_TEAM'], ARRAY['SUPER_ADMIN','HRBP','TA_TEAM'], NOW(), NOW()),
  (gen_random_uuid(), '/summary-by-position', 'Summary by Position', ARRAY['SUPER_ADMIN','Management','Head of Division','HRBP','TA_TEAM','HIRING_MANAGER'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], NOW(), NOW()),
  (gen_random_uuid(), '/reports', 'Reports', ARRAY['SUPER_ADMIN','Management','Head of Division','HRBP','TA_TEAM','HIRING_MANAGER'], ARRAY['SUPER_ADMIN','HRBP','TA_TEAM'], ARRAY['SUPER_ADMIN','HRBP','TA_TEAM'], NOW(), NOW()),
  (gen_random_uuid(), '/team', 'Team', ARRAY['SUPER_ADMIN','TA_TEAM'], ARRAY['SUPER_ADMIN','TA_TEAM'], ARRAY['SUPER_ADMIN','TA_TEAM'], NOW(), NOW()),
  (gen_random_uuid(), '/masters/division', 'Master Division', ARRAY['SUPER_ADMIN','TA_TEAM'], ARRAY['SUPER_ADMIN','TA_TEAM'], ARRAY['SUPER_ADMIN','TA_TEAM'], NOW(), NOW()),
  (gen_random_uuid(), '/masters/office-location', 'Master Office Location', ARRAY['SUPER_ADMIN','TA_TEAM'], ARRAY['SUPER_ADMIN','TA_TEAM'], ARRAY['SUPER_ADMIN','TA_TEAM'], NOW(), NOW()),
  (gen_random_uuid(), '/settings', 'Settings', ARRAY['SUPER_ADMIN','Management','Head of Division','HRBP','TA_TEAM','HIRING_MANAGER'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], NOW(), NOW())
ON CONFLICT ("menuPath") DO NOTHING;

