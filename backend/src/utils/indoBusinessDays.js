const Holidays = require('date-holidays');

const hd = new Holidays('ID');

const toYmd = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const isWeekend = (d) => {
  const day = d.getDay();
  return day === 0 || day === 6;
};

function isIndonesiaWorkingDay(d) {
  if (isWeekend(d)) return false;
  const holidays = hd.getHolidays(d.getFullYear());
  const ymd = toYmd(d);
  const isHoliday = holidays.some((h) => (h.date || '').slice(0, 10) === ymd);
  return !isHoliday;
}

/** Counts working days between start and end, excluding start and including end. */
function businessDaysDiffIndonesia(start, end) {
  const startDay = new Date(start);
  const endDay = new Date(end);
  startDay.setHours(0, 0, 0, 0);
  endDay.setHours(0, 0, 0, 0);
  if (endDay.getTime() <= startDay.getTime()) return 0;

  let count = 0;
  const cursor = new Date(startDay);
  cursor.setDate(cursor.getDate() + 1);

  while (cursor.getTime() <= endDay.getTime()) {
    if (isIndonesiaWorkingDay(cursor)) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

function getSlaBucketIndonesiaWorkingDays(referenceDate, now = new Date()) {
  const diff = businessDaysDiffIndonesia(referenceDate, now);
  if (diff <= 30) return '0-30 Days';
  if (diff <= 60) return '31-60 Days';
  if (diff <= 90) return '61-90 Days';
  return 'Above 91 Days';
}

module.exports = {
  businessDaysDiffIndonesia,
  getSlaBucketIndonesiaWorkingDays,
  isIndonesiaWorkingDay,
};
