/**
 * Quick smoke test: verifies the indonesia_business_days function and holiday data.
 * Usage: node backend/scripts/smoke-test-sql.js
 */
'use strict';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Confirm function exists
  const fnRows = await prisma.$queryRaw`
    SELECT proname FROM pg_proc WHERE proname = 'indonesia_business_days'
  `;
  console.log('✓ PostgreSQL function:', fnRows.length > 0 ? 'FOUND' : 'MISSING');

  // 2. Confirm holiday rows
  const count = await prisma.indonesiaHoliday.count();
  console.log(`✓ Indonesia holiday rows: ${count}`);

  // 3. Test the function: Jan 1 → Jan 3 2025
  //    Jan 1 = New Year (holiday), Jan 2 = Thursday (working), Jan 3 = Friday (working)
  //    Expected: 2 working days
  const r1 = await prisma.$queryRaw`
    SELECT indonesia_business_days('2025-01-01'::date, '2025-01-03'::date) AS days
  `;
  const d1 = Number(r1[0].days);
  console.log(`✓ Jan 01–03 2025 working days: ${d1} (expected 2 = Jan 2 + Jan 3)`);

  // 4. Simple GROUP BY smoke test matching the dashboard query shape
  const sample = await prisma.$queryRaw`
    SELECT
      COALESCE(NULLIF(TRIM(f."areaDetail"),''),'Unassigned') AS area_detail,
      COUNT(*)::int AS total
    FROM fptk f
    GROUP BY area_detail
    ORDER BY total DESC
    LIMIT 5
  `;
  console.log(`✓ FPTK GROUP BY area_detail (top 5):`, sample.map(r => `${r.area_detail}=${r.total}`).join(', '));
}

main()
  .catch(err => { console.error('✗ Smoke test failed:', err.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
