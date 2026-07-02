/**
 * Seed script: populate the indonesia_holidays table for a range of years.
 * Uses the same `date-holidays` package that indoBusinessDays.js uses in Node.js,
 * so the SQL function and the JS fallback stay in perfect sync.
 *
 * Usage:
 *   node backend/scripts/seed-indonesia-holidays.js [startYear] [endYear]
 *   e.g.  node backend/scripts/seed-indonesia-holidays.js 2024 2028
 *
 * Default range: current year − 1  …  current year + 3
 */

'use strict';

const { PrismaClient } = require('@prisma/client');
const Holidays = require('date-holidays');

const prisma = new PrismaClient();

async function seedHolidays(startYear, endYear) {
  const hd = new Holidays('ID');
  const rows = [];

  for (let year = startYear; year <= endYear; year++) {
    const holidays = hd.getHolidays(year);
    for (const h of holidays) {
      // getHolidays returns objects with h.date (ISO string like "2024-01-01 00:00:00")
      // or h.start (Date object). Use whichever is available.
      const rawDate = h.date ? String(h.date).slice(0, 10) : null;
      if (!rawDate) continue;
      rows.push({ date: new Date(rawDate), name: h.name || null, year });
    }
  }

  if (rows.length === 0) {
    console.log('No holiday data returned by date-holidays for range', startYear, '-', endYear);
    return;
  }

  // Upsert: if the date already exists, update name/year
  let upserted = 0;
  for (const row of rows) {
    await prisma.indonesiaHoliday.upsert({
      where: { date: row.date },
      update: { name: row.name, year: row.year },
      create: row,
    });
    upserted++;
  }

  console.log(`Seeded ${upserted} Indonesia holiday rows for years ${startYear}–${endYear}.`);
}

async function main() {
  const currentYear = new Date().getFullYear();
  const startYear = parseInt(process.argv[2] ?? currentYear - 1, 10);
  const endYear   = parseInt(process.argv[3] ?? currentYear + 3, 10);

  if (isNaN(startYear) || isNaN(endYear) || startYear > endYear) {
    console.error('Usage: node seed-indonesia-holidays.js [startYear] [endYear]');
    process.exit(1);
  }

  console.log(`Seeding Indonesia holidays for ${startYear}–${endYear}...`);
  await seedHolidays(startYear, endYear);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
