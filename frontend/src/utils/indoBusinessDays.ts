import Holidays from 'date-holidays'

const hd = new Holidays('ID')

const toYmd = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const isWeekend = (d: Date) => {
  const day = d.getDay()
  return day === 0 || day === 6
}

/** Memoised Set<'YYYY-MM-DD'> per calendar year — built once, reused on every call. */
const _holidaySetCache = new Map<number, Set<string>>()

function getHolidaySetForYear(year: number): Set<string> {
  if (!_holidaySetCache.has(year)) {
    const raw = hd.getHolidays(year)
    _holidaySetCache.set(year, new Set(raw.map((h) => (h.date || '').slice(0, 10))))
  }
  return _holidaySetCache.get(year)!
}

export const isIndonesiaWorkingDay = (d: Date) => {
  if (isWeekend(d)) return false
  return !getHolidaySetForYear(d.getFullYear()).has(toYmd(d))
}

// Counts working days between start and end, excluding the start date and including the end date.
// If end <= start, returns 0.
export const businessDaysDiffIndonesia = (start: Date, end: Date) => {
  const startDay = new Date(start)
  const endDay = new Date(end)
  startDay.setHours(0, 0, 0, 0)
  endDay.setHours(0, 0, 0, 0)
  if (endDay.getTime() <= startDay.getTime()) return 0

  let count = 0
  const cursor = new Date(startDay)
  cursor.setDate(cursor.getDate() + 1)

  while (cursor.getTime() <= endDay.getTime()) {
    if (isIndonesiaWorkingDay(cursor)) count += 1
    cursor.setDate(cursor.getDate() + 1)
  }
  return count
}

export const getSlaBucketIndonesiaWorkingDays = (referenceDate: Date, now = new Date()) => {
  const diff = businessDaysDiffIndonesia(referenceDate, now)
  if (diff <= 30) return '0-30 Days'
  if (diff <= 60) return '31-60 Days'
  if (diff <= 90) return '61-90 Days'
  return 'Above 91 Days'
}

