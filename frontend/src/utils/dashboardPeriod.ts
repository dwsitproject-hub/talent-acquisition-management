import { parseTimestamp, isTimestampInRange, computeWeekOverWeekPercent, type WeekOverWeekPercentResult } from '@/utils/weekOverWeek'

export type DashboardTimeMode = 'week' | 'month' | 'custom'

export type DateRange = { start: Date; end: Date }

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** ISO 8601 week: Monday 00:00:00 to Sunday 23:59:59.999 (matches HTML input type="week" in most browsers) */
export function getISOWeekRangeFromInput(weekValue: string): DateRange | null {
  const m = /^(\d{4})-W(\d{2})$/.exec((weekValue || '').trim())
  if (!m) return null
  const year = parseInt(m[1], 10)
  const week = parseInt(m[2], 10)
  if (week < 1 || week > 53) return null
  // Thursday in week 1: Jan 1–7 contains week 1's Thursday; use week 1 Monday from Jan 4
  const jan4 = new Date(year, 0, 4)
  const mondayW1 = new Date(jan4)
  const d = (jan4.getDay() + 6) % 7
  mondayW1.setDate(4 - d)
  mondayW1.setHours(0, 0, 0, 0)
  const start = new Date(mondayW1)
  start.setDate(mondayW1.getDate() + (week - 1) * 7)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

/** Default value for `<input type="week" />` for a given date (local). */
export function toWeekInputValue(reference: Date = new Date()): string {
  const d = new Date(reference)
  d.setHours(12, 0, 0, 0)
  const day = (d.getDay() + 6) % 7
  const monday = new Date(d)
  monday.setDate(d.getDate() - day)
  monday.setHours(0, 0, 0, 0)
  const thursday = new Date(monday)
  thursday.setDate(monday.getDate() + 3)
  const isoYear = thursday.getFullYear()
  const jan4 = new Date(isoYear, 0, 4)
  const j4d = (jan4.getDay() + 6) % 7
  const week1Monday = new Date(jan4)
  week1Monday.setDate(4 - j4d)
  week1Monday.setHours(0, 0, 0, 0)
  const week = 1 + Math.round((monday.getTime() - week1Monday.getTime()) / (7 * 86400000))
  if (week < 1) {
    return toWeekInputValue(new Date(isoYear - 1, 11, 28))
  }
  return `${isoYear}-W${String(Math.min(week, 53)).padStart(2, '0')}`
}

export function getMonthRangeFromInput(monthValue: string): DateRange | null {
  const m = /^(\d{4})-(\d{2})$/.exec((monthValue || '').trim())
  if (!m) return null
  const y = parseInt(m[1], 10)
  const mo = parseInt(m[2], 10) - 1
  if (mo < 0 || mo > 11) return null
  const start = new Date(y, mo, 1, 0, 0, 0, 0)
  const end = new Date(y, mo + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

export function getPreviousMonthRange(monthValue: string): DateRange | null {
  const cur = getMonthRangeFromInput(monthValue)
  if (!cur) return null
  const s = new Date(cur.start)
  s.setDate(0)
  s.setDate(1)
  s.setHours(0, 0, 0, 0)
  const e = new Date(s.getFullYear(), s.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start: s, end: e }
}

export function getPreviousWeekRange(weekValue: string): DateRange | null {
  const cur = getISOWeekRangeFromInput(weekValue)
  if (!cur) return null
  const start = new Date(cur.start)
  start.setDate(start.getDate() - 7)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function daysInclusiveMs(s: Date, e: Date): number {
  const a = startOfDay(s).getTime()
  const b = startOfDay(e).getTime()
  return Math.floor((b - a) / 86400000) + 1
}

export function getCustomRangeFromInputs(startStr: string, endStr: string): DateRange | null {
  const a = (startStr || '').trim()
  const b = (endStr || '').trim()
  if (!a || !b) return null
  const start = parseTimestamp(`${a}T00:00:00`)
  const end = parseTimestamp(`${b}T23:59:59.999`)
  if (!start || !end) return null
  if (start.getTime() > end.getTime()) return null
  return { start, end }
}

/** Previous period of the same length ending the day before `current.start` */
export function getPreviousEqualRange(current: DateRange): DateRange {
  const n = daysInclusiveMs(current.start, current.end)
  const end = new Date(current.start)
  end.setDate(end.getDate() - 1)
  end.setHours(23, 59, 59, 999)
  const start = new Date(end)
  start.setDate(end.getDate() - (n - 1))
  start.setHours(0, 0, 0, 0)
  return { start, end }
}

export type PeriodBounds = { current: DateRange; previous: DateRange }

export function getDashboardPeriodBounds(
  mode: DashboardTimeMode,
  opts: {
    weekValue: string
    monthValue: string
    customStart: string
    customEnd: string
  }
): PeriodBounds | null {
  if (mode === 'month') {
    const current = getMonthRangeFromInput(opts.monthValue)
    const previous = getPreviousMonthRange(opts.monthValue)
    if (!current || !previous) return null
    return { current, previous }
  }
  if (mode === 'week') {
    const current = getISOWeekRangeFromInput(opts.weekValue)
    const previous = getPreviousWeekRange(opts.weekValue)
    if (!current || !previous) return null
    return { current, previous }
  }
  const current = getCustomRangeFromInputs(opts.customStart, opts.customEnd)
  if (!current) return null
  const previous = getPreviousEqualRange(current)
  return { current, previous }
}

export function toMonthInputValue(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  return `${y}-${String(m).padStart(2, '0')}`
}

export function itemTimestampInRange(
  value: string | Date | null | undefined,
  range: DateRange
): boolean {
  const t = parseTimestamp(value)
  if (!t) return false
  return isTimestampInRange(t, range.start, range.end)
}

export function periodOverPeriodChange(
  currentCount: number,
  previousCount: number
): WeekOverWeekPercentResult {
  return computeWeekOverWeekPercent(currentCount, previousCount)
}
