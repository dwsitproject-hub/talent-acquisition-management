-- Performance indexes for getSummaryByPosition and related queries.
-- All indexes are created CONCURRENTLY so they do not block reads/writes
-- on busy tables during deployment.

-- Composite index on applications(fptkId, status):
-- Enables an index-only GROUP BY scan for application.groupBy(['fptkId','status'])
-- avoiding a full sequential scan of the applications table.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "applications_fptkId_status_idx"
  ON "applications" ("fptkId", "status");

-- Index on fptk(currentStatus):
-- Used by getFptkCurrentStatusCounts, buildInternalFptkListWhere, and list filters.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "fptk_currentStatus_idx"
  ON "fptk" ("currentStatus");

-- Index on fptk(createdAt):
-- Used by getSummaryByPosition ORDER BY createdAt DESC.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "fptk_createdAt_idx"
  ON "fptk" ("createdAt");
