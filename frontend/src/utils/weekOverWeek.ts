/**
 * Rolling calendar windows: last 7 days (inclusive through end of today)
 * vs the 7 days immediately before that.
 */

export type RollingWeekBounds = {
  currentStart: Date
  currentEnd: Date
  previousStart: Date
  previousEnd: Date
}

export function parseTimestamp(value?: string | Date | null): Date | null {
  if (value == null) return null
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value
  }
  const date = new Date(value)
  if (!isNaN(date.getTime())) return date
  try {
    const d = new Date(`${value}T00:00:00`)
    return isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

/**
 * Current window: from start of (reference − 6 days) through end of reference day (7 calendar days).
 * Previous window: the 7 calendar days immediately before that.
 */
export function getRollingWeekWindowBounds(referenceDate: Date = new Date()): RollingWeekBounds {
  const ref = new Date(referenceDate)
  const currentEnd = endOfDay(ref)
  const currentStart = startOfDay(ref)
  currentStart.setDate(currentStart.getDate() - 6)

  const previousEnd = new Date(currentStart)
  previousEnd.setMilliseconds(previousEnd.getMilliseconds() - 1)
  const previousStart = startOfDay(previousEnd)
  previousStart.setDate(previousStart.getDate() - 6)

  return { currentStart, currentEnd, previousStart, previousEnd }
}

export function isTimestampInRange(date: Date, start: Date, end: Date): boolean {
  const t = date.getTime()
  return t >= start.getTime() && t <= end.getTime()
}

export type WeekOverWeekSentiment = 'positive' | 'negative' | 'neutral'

export type WeekOverWeekPercentResult = {
  currentCount: number
  previousCount: number
  /** Raw percentage; meaningful when previousCount > 0 */
  rawPercent: number
  /** Display string without forcing double signs (e.g. "+12%", "-3%", "0%") */
  formattedChange: string
  sentiment: WeekOverWeekSentiment
}

/**
 * ((Current − Previous) / Previous) × 100.
 * If Previous === 0: returns 0% neutral when Current === 0, otherwise +100% positive (no division by zero).
 */
export function computeWeekOverWeekPercent(
  currentCount: number,
  previousCount: number
): WeekOverWeekPercentResult {
  let rawPercent = 0
  let sentiment: WeekOverWeekSentiment = 'neutral'
  let formattedChange = '0%'

  if (previousCount === 0) {
    if (currentCount === 0) {
      return {
        currentCount,
        previousCount,
        rawPercent: 0,
        formattedChange: '0%',
        sentiment: 'neutral',
      }
    }
    rawPercent = 100
    sentiment = 'positive'
    formattedChange = '+100%'
    return { currentCount, previousCount, rawPercent, formattedChange, sentiment }
  }

  rawPercent = ((currentCount - previousCount) / previousCount) * 100
  const rounded = Math.round(rawPercent)

  if (rounded === 0) {
    sentiment = 'neutral'
    formattedChange = '0%'
  } else if (rounded > 0) {
    sentiment = 'positive'
    formattedChange = `+${rounded}%`
  } else {
    sentiment = 'negative'
    formattedChange = `${rounded}%`
  }

  return {
    currentCount,
    previousCount,
    rawPercent,
    formattedChange,
    sentiment,
  }
}

export type WeekOverWeekDatasetOptions<T> = {
  referenceDate?: Date
  /** Only include rows where predicate passes (e.g. status / join filter) */
  predicate?: (item: T) => boolean
}

/**
 * Counts rows whose timestamp falls in the current vs previous rolling week, then returns WoW %.
 */
export function weekOverWeekFromDataset<T>(
  items: readonly T[],
  getTimestamp: (item: T) => string | Date | null | undefined,
  options?: WeekOverWeekDatasetOptions<T>
): WeekOverWeekPercentResult {
  const bounds = getRollingWeekWindowBounds(options?.referenceDate ?? new Date())
  const pred = options?.predicate

  let currentCount = 0
  let previousCount = 0

  for (const item of items) {
    if (pred && !pred(item)) continue
    const date = parseTimestamp(getTimestamp(item))
    if (!date) continue
    if (isTimestampInRange(date, bounds.currentStart, bounds.currentEnd)) {
      currentCount += 1
    } else if (isTimestampInRange(date, bounds.previousStart, bounds.previousEnd)) {
      previousCount += 1
    }
  }

  return computeWeekOverWeekPercent(currentCount, previousCount)
}

export function countInRollingWindows<T>(
  items: readonly T[],
  getTimestamp: (item: T) => string | Date | null | undefined,
  options?: WeekOverWeekDatasetOptions<T>
): { current: number; previous: number } {
  const r = weekOverWeekFromDataset(items, getTimestamp, options)
  return { current: r.currentCount, previous: r.previousCount }
}
