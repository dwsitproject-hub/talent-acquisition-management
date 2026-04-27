/**
 * Timestamps and period-over-period delta display for the dashboard.
 */

export type WeekOverWeekPercentResult = {
  /** Short label, e.g. "+12%" or "7" */
  formattedChange: string
  /** Drives up/down/flat coloring on the home dashboard */
  sentiment: 'positive' | 'negative' | 'neutral'
}

/**
 * Parse API / form values to a local Date, or null if not parseable.
 */
export function parseTimestamp(value: string | Date | null | undefined): Date | null {
  if (value == null) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  const s = String(value).trim()
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Inclusive range check [start, end].
 */
export function isTimestampInRange(t: Date, start: Date, end: Date): boolean {
  const x = t.getTime()
  return x >= start.getTime() && x <= end.getTime()
}

/**
 * Week-over-week / period-over-period percent: (current − previous) / previous.
 * When previous is 0, we avoid division by zero with small copy that still reads well on cards.
 */
export function computeWeekOverWeekPercent(
  currentCount: number,
  previousCount: number
): WeekOverWeekPercentResult {
  const c = Math.max(0, Number(currentCount))
  const p = Math.max(0, Number(previousCount))
  if (!Number.isFinite(c) || !Number.isFinite(p)) {
    return { formattedChange: '—', sentiment: 'neutral' }
  }
  if (p === 0 && c === 0) {
    return { formattedChange: '0%', sentiment: 'neutral' }
  }
  if (p === 0) {
    return { formattedChange: `${Math.round(c)}`, sentiment: c > 0 ? 'positive' : 'neutral' }
  }
  const rawPct = ((c - p) / p) * 100
  const rounded = Math.round(rawPct * 10) / 10
  const sign = rounded > 0 ? '+' : ''
  const body = Math.abs(rounded) < 0.05 && rounded !== 0 ? `${sign}${rawPct.toFixed(1)}` : `${sign}${rounded}`
  const formattedChange = `${body}%`
  if (rounded > 0) {
    return { formattedChange, sentiment: 'positive' }
  }
  if (rounded < 0) {
    return { formattedChange, sentiment: 'negative' }
  }
  return { formattedChange, sentiment: 'neutral' }
}
