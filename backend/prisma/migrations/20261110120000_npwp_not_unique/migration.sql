-- NPWP is no longer unique (placeholder values such as "000" may repeat across candidates).
ALTER TABLE "candidates" DROP CONSTRAINT IF EXISTS "candidates_npwpNumber_key";
DROP INDEX IF EXISTS "candidates_npwpNumber_key";

-- Keep lookups fast with a plain index.
CREATE INDEX IF NOT EXISTS "candidates_npwpNumber_idx" ON "candidates"("npwpNumber");
