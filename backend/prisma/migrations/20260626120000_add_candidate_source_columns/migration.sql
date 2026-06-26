-- Add dedicated source columns on candidates (migrated from languages JSON)
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "sourceDetail" TEXT;

-- Backfill from languages JSON
UPDATE "candidates"
SET
  "source" = COALESCE(
    NULLIF(TRIM("source"), ''),
    NULLIF(TRIM("languages"->>'source'), '')
  ),
  "sourceDetail" = COALESCE(
    NULLIF(TRIM("sourceDetail"), ''),
    NULLIF(TRIM("languages"->>'sourceDetail'), '')
  )
WHERE "languages" IS NOT NULL
  AND ("languages" ? 'source' OR "languages" ? 'sourceDetail');

-- Backfill source from candidate self-service form payload when still empty
UPDATE "candidates"
SET "source" = NULLIF(TRIM("formDataDiri"->>'source'), '')
WHERE ("source" IS NULL OR TRIM("source") = '')
  AND "formDataDiri" IS NOT NULL
  AND "formDataDiri" ? 'source';

UPDATE "candidates"
SET "sourceDetail" = NULLIF(TRIM("formDataDiri"->>'sourceDetail'), '')
WHERE ("sourceDetail" IS NULL OR TRIM("sourceDetail") = '')
  AND "formDataDiri" IS NOT NULL
  AND "formDataDiri" ? 'sourceDetail';

-- Remove legacy keys from languages JSON
UPDATE "candidates"
SET "languages" = "languages" - 'source' - 'sourceDetail'
WHERE "languages" IS NOT NULL
  AND ("languages" ? 'source' OR "languages" ? 'sourceDetail');

CREATE INDEX IF NOT EXISTS "candidates_source_idx" ON "candidates"("source");
