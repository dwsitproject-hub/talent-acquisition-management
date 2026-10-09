/**
 * Summary by Position — Overview tab aggregation (pure, no React).
 *
 * Charts group positions by Site (PT), Division and Hiring Manager and show
 * Closed vs Open, with Open split by the position's current SLA bucket.
 *
 * Metric:
 *   - 'headcount' → each FPTK contributes its Total Request (blank/0 = 1)
 *   - 'positions' → each FPTK contributes 1
 * Closed/Open uses the canonical rule in `fptkPositionStatus.ts`
 * (Close · Cancel · Internal Movement = Closed), so Open + Closed = Total.
 */
import { isFptkClosedByCurrentStatus } from '@/utils/fptkPositionStatus'

export const UNASSIGNED_SITE = 'Unassigned Site'
export const UNASSIGNED_DIVISION = 'Unassigned Division'
export const UNASSIGNED_HIRING_MANAGER = 'Unassigned Hiring Manager'
export const OVERDUE_SLA_BUCKET = 'Above 91 Days'

export type OverviewMetric = 'headcount' | 'positions'
export type OverviewDimension = 'site' | 'division' | 'hm'

export const OVERVIEW_DIMENSION_LABEL: Record<OverviewDimension, string> = {
  site: 'Site (PT)',
  division: 'Division',
  hm: 'Hiring Manager',
}

/** Open-bar stack order. 'none' = open position without an SLA start date. */
export const OPEN_SLA_BUCKETS = ['0-30 Days', '31-60 Days', '61-90 Days', OVERDUE_SLA_BUCKET, 'none'] as const
export type OpenSlaBucket = (typeof OPEN_SLA_BUCKETS)[number]

export interface TimeToOfferStats {
  hires: number
  totalDays: number
  /** ISO timestamps of each hire's offer acceptance. */
  acceptedAt: string[]
}

/** Fields of a Summary-by-Position row the overview needs. */
export interface OverviewSourceRow {
  id: string
  pt: string
  location: string
  division: string
  hiringManager: string
  currentStatus: string
  sla: string
  slaDays: number | null
  totalRequest: number | null
  timeToOffer: TimeToOfferStats | null
  offerAcceptedAt: string | null
  /** SLA start date: FPTK receive date → request date → created at. */
  referenceDate: string | null
}

export interface OverviewSelection {
  dimension: OverviewDimension
  value: string
}

export interface OverviewGroup {
  name: string
  positionCount: number
  closed: number
  open: number
  openByBucket: Record<OpenSlaBucket, number>
  /** Open headcount/positions in the Above 91 Days bucket. */
  overdue: number
  hires: number
  /** Hire-weighted Indonesia working days, applied → offer accepted. */
  avgTimeToOfferDays: number | null
  /** Mean working-day SLA of the group's open positions. */
  avgOpenSlaDays: number | null
}

/** "Karawaci (CRC)" = Area Detail + PT. Falls back gracefully when either is missing. */
export function formatSiteLabel(location: string, pt: string): string {
  const site = location && location !== '-' ? location.trim() : ''
  const company = pt && pt !== '-' ? pt.trim() : ''
  if (site && company) return `${site} (${company})`
  if (site) return site
  if (company) return company
  return UNASSIGNED_SITE
}

export function divisionLabel(division: string): string {
  return division && division !== '-' ? division.trim() : UNASSIGNED_DIVISION
}

function hiringManagerLabel(hm: string): string {
  const v = (hm || '').trim()
  return v && v !== '—' && v !== '-' ? v : UNASSIGNED_HIRING_MANAGER
}

export function overviewGroupName(row: OverviewSourceRow, dimension: OverviewDimension): string {
  if (dimension === 'site') return formatSiteLabel(row.location, row.pt)
  if (dimension === 'division') return divisionLabel(row.division)
  return hiringManagerLabel(row.hiringManager)
}

export function matchesOverviewSelection(row: OverviewSourceRow, selection: OverviewSelection | null): boolean {
  if (!selection) return true
  return overviewGroupName(row, selection.dimension) === selection.value
}

/** Sorts names alphabetically, keeping the "Unassigned …" buckets last. */
export function compareGroupNames(a: string, b: string): number {
  const isUnassigned = (n: string) =>
    n === UNASSIGNED_SITE || n === UNASSIGNED_DIVISION || n === UNASSIGNED_HIRING_MANAGER
  const au = isUnassigned(a)
  const bu = isUnassigned(b)
  if (au !== bu) return au ? 1 : -1
  return a.localeCompare(b, undefined, { sensitivity: 'base' })
}

export function metricWeight(row: Pick<OverviewSourceRow, 'totalRequest'>, metric: OverviewMetric): number {
  if (metric === 'positions') return 1
  const n = Number(row.totalRequest)
  return Number.isFinite(n) && n > 0 ? n : 1
}

function openBucketOf(sla: string): OpenSlaBucket {
  return (OPEN_SLA_BUCKETS as readonly string[]).includes(sla) && sla !== 'none'
    ? (sla as OpenSlaBucket)
    : 'none'
}

function emptyBuckets(): Record<OpenSlaBucket, number> {
  return { '0-30 Days': 0, '31-60 Days': 0, '61-90 Days': 0, [OVERDUE_SLA_BUCKET]: 0, none: 0 } as Record<
    OpenSlaBucket,
    number
  >
}

/**
 * Groups rows by dimension. Sorted by Open (desc), then oldest average SLA,
 * then name — the groups needing attention first.
 */
export function buildOverviewGroups(
  rows: OverviewSourceRow[],
  dimension: OverviewDimension,
  metric: OverviewMetric
): OverviewGroup[] {
  type Acc = OverviewGroup & { openSlaSum: number; openSlaN: number; offerDaysSum: number }
  const byName = new Map<string, Acc>()

  rows.forEach((row) => {
    const name = overviewGroupName(row, dimension)
    let g = byName.get(name)
    if (!g) {
      g = {
        name,
        positionCount: 0,
        closed: 0,
        open: 0,
        openByBucket: emptyBuckets(),
        overdue: 0,
        hires: 0,
        avgTimeToOfferDays: null,
        avgOpenSlaDays: null,
        openSlaSum: 0,
        openSlaN: 0,
        offerDaysSum: 0,
      }
      byName.set(name, g)
    }
    const w = metricWeight(row, metric)
    g.positionCount += 1
    if (isFptkClosedByCurrentStatus(row.currentStatus)) {
      g.closed += w
    } else {
      g.open += w
      g.openByBucket[openBucketOf(row.sla)] += w
      if (row.slaDays != null) {
        g.openSlaSum += row.slaDays
        g.openSlaN += 1
      }
    }
    if (row.timeToOffer && row.timeToOffer.hires > 0) {
      g.hires += row.timeToOffer.hires
      g.offerDaysSum += row.timeToOffer.totalDays
    }
  })

  return Array.from(byName.values())
    .map(({ openSlaSum, openSlaN, offerDaysSum, ...g }) => ({
      ...g,
      overdue: g.openByBucket[OVERDUE_SLA_BUCKET],
      avgTimeToOfferDays: g.hires > 0 ? Math.round(offerDaysSum / g.hires) : null,
      avgOpenSlaDays: openSlaN > 0 ? Math.round(openSlaSum / openSlaN) : null,
    }))
    .sort(
      (a, b) =>
        b.open - a.open ||
        (b.avgOpenSlaDays ?? -1) - (a.avgOpenSlaDays ?? -1) ||
        compareGroupNames(a.name, b.name)
    )
}

// ---------- Request date range ----------

export type RequestDateRange = 'all' | '3m' | '6m' | '12m' | 'ytd'

export const REQUEST_DATE_RANGE_OPTIONS: { id: RequestDateRange; label: string }[] = [
  { id: 'ytd', label: 'This year' },
  { id: '3m', label: 'Last 3 months' },
  { id: '6m', label: 'Last 6 months' },
  { id: '12m', label: 'Last 12 months' },
  { id: 'all', label: 'All time' },
]

export function requestDateCutoff(range: RequestDateRange, now: Date = new Date()): Date | null {
  if (range === 'all') return null
  if (range === 'ytd') return new Date(now.getFullYear(), 0, 1)
  const months = range === '3m' ? 3 : range === '6m' ? 6 : 12
  return new Date(now.getFullYear(), now.getMonth() - months, now.getDate())
}

export function matchesRequestDateRange(referenceDate: string | null, cutoff: Date | null): boolean {
  if (!cutoff) return true
  if (!referenceDate) return false
  const d = new Date(referenceDate)
  return !Number.isNaN(d.getTime()) && d.getTime() >= cutoff.getTime()
}

// ---------- Vacancy trend ----------

export interface TrendMonth {
  key: string
  /** Axis label, e.g. "Mar"; the first month and every January carry the year ("Jan '26"). */
  label: string
  /** e.g. "Mar 2026" */
  fullLabel: string
  opened: number
  filled: number
  /** Running total of `opened` from the first month in the window. */
  cumulativeOpened: number
}

const MAX_TREND_MONTHS = 12

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Months the trend shows for a Request date range: from the range's start
 * month through the current month (e.g. This year → Jan…now), capped at 12;
 * All time shows the last 12.
 */
export function trendMonthCount(range: RequestDateRange, now: Date = new Date()): number {
  const cutoff = requestDateCutoff(range, now)
  if (!cutoff) return MAX_TREND_MONTHS
  const span = (now.getFullYear() - cutoff.getFullYear()) * 12 + (now.getMonth() - cutoff.getMonth()) + 1
  return Math.min(MAX_TREND_MONTHS, Math.max(1, span))
}

/**
 * Last `months` calendar months (oldest first).
 * Opened = positions/headcount by SLA start month.
 * Filled = positions by first offer acceptance (positions metric), or
 *          each accepted hire by acceptance month (headcount metric).
 */
export function buildVacancyTrend(
  rows: OverviewSourceRow[],
  metric: OverviewMetric,
  now: Date = new Date(),
  months = MAX_TREND_MONTHS
): TrendMonth[] {
  const out: TrendMonth[] = []
  const index = new Map<string, TrendMonth>()
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const short = d.toLocaleDateString('en-US', { month: 'short' })
    const withYear = out.length === 0 || d.getMonth() === 0
    const m: TrendMonth = {
      key: monthKey(d),
      label: withYear ? `${short} '${String(d.getFullYear()).slice(2)}` : short,
      fullLabel: `${short} ${d.getFullYear()}`,
      opened: 0,
      filled: 0,
      cumulativeOpened: 0,
    }
    out.push(m)
    index.set(m.key, m)
  }
  const bump = (iso: string | null, field: 'opened' | 'filled', by: number) => {
    if (!iso) return
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return
    const m = index.get(monthKey(d))
    if (m) m[field] += by
  }
  rows.forEach((row) => {
    bump(row.referenceDate, 'opened', metricWeight(row, metric))
    if (metric === 'positions') bump(row.offerAcceptedAt, 'filled', 1)
    else row.timeToOffer?.acceptedAt.forEach((iso) => bump(iso, 'filled', 1))
  })
  let running = 0
  out.forEach((m) => {
    running += m.opened
    m.cumulativeOpened = running
  })
  return out
}
