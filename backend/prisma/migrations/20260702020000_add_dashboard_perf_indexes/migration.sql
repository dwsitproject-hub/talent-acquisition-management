-- Migration: add_dashboard_perf_indexes
-- Adds indexes on FPTK and Application tables to speed up dashboard queries.
-- All CREATE INDEX statements use IF NOT EXISTS to be safe against partial runs.

-- FPTK: updatedAt (used in period-based date-range filters)
CREATE INDEX IF NOT EXISTS "fptk_updatedAt_idx" ON "fptk"("updatedAt");

-- FPTK: areaDetail (used in location overview grouping and SLA charts)
CREATE INDEX IF NOT EXISTS "fptk_areaDetail_idx" ON "fptk"("areaDetail");

-- FPTK: fptkReceiveDate (used for SLA calculation)
CREATE INDEX IF NOT EXISTS "fptk_fptkReceiveDate_idx" ON "fptk"("fptkReceiveDate");

-- FPTK: composite (areaDetail, currentStatus) — covers the location overview query
CREATE INDEX IF NOT EXISTS "fptk_areaDetail_currentStatus_idx" ON "fptk"("areaDetail", "currentStatus");

-- FPTK: composite (currentStatus, updatedAt) — covers hiredThisMonth and period filters
CREATE INDEX IF NOT EXISTS "fptk_currentStatus_updatedAt_idx" ON "fptk"("currentStatus", "updatedAt");

-- Application: updatedAt (used in period-based groupBy queries for WoW comparison)
CREATE INDEX IF NOT EXISTS "applications_updatedAt_idx" ON "applications"("updatedAt");

-- Application: composite (status, updatedAt) — covers period groupBy with status filter
CREATE INDEX IF NOT EXISTS "applications_status_updatedAt_idx" ON "applications"("status", "updatedAt");
