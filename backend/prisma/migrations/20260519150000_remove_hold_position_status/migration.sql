-- Remove deprecated "Hold" position current status (migrate existing rows to Open).
UPDATE fptk
SET "currentStatus" = 'Open'
WHERE LOWER(TRIM("currentStatus")) = 'hold';

UPDATE fptk_status_history
SET "fromStatus" = 'Open'
WHERE "fromStatus" IS NOT NULL AND LOWER(TRIM("fromStatus")) = 'hold';

UPDATE fptk_status_history
SET "toStatus" = 'Open'
WHERE LOWER(TRIM("toStatus")) = 'hold';
