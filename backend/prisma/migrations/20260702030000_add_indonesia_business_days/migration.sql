-- Migration: indonesia_holidays table + indonesia_business_days SQL function
-- This enables server-side SLA aggregation using GROUP BY in getDashboardStats,
-- replacing the JavaScript loop that iterated every FPTK row one-by-one.

-- 1. Holiday reference table (populated by seed-indonesia-holidays.js)
CREATE TABLE IF NOT EXISTS "indonesia_holidays" (
  "date" DATE        NOT NULL,
  "name" VARCHAR(255),
  "year" INTEGER     NOT NULL,
  PRIMARY KEY ("date")
);

CREATE INDEX IF NOT EXISTS "indonesia_holidays_year_idx" ON "indonesia_holidays" ("year");

-- 2. PostgreSQL function: count Indonesia working days between two dates
--    Mirrors the Node.js businessDaysDiffIndonesia() logic in indoBusinessDays.js:
--      - skip weekends (DOW 0=Sunday, 6=Saturday)
--      - skip dates listed in indonesia_holidays
--      - counts the day AFTER start_d up to and including end_d  (same as JS impl)
CREATE OR REPLACE FUNCTION indonesia_business_days(start_d DATE, end_d DATE)
RETURNS INTEGER AS $$
DECLARE
  day_count INTEGER := 0;
  curr      DATE;
BEGIN
  IF start_d IS NULL OR end_d IS NULL OR end_d <= start_d THEN
    RETURN 0;
  END IF;
  curr := start_d + INTERVAL '1 day';
  WHILE curr <= end_d LOOP
    -- Skip Saturday (6) and Sunday (0)
    IF EXTRACT(DOW FROM curr) NOT IN (0, 6) THEN
      -- Skip public holidays
      IF NOT EXISTS (SELECT 1 FROM "indonesia_holidays" WHERE "date" = curr) THEN
        day_count := day_count + 1;
      END IF;
    END IF;
    curr := curr + INTERVAL '1 day';
  END LOOP;
  RETURN day_count;
END;
$$ LANGUAGE plpgsql STABLE;
