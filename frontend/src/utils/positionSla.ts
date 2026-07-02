import { businessDaysDiffIndonesia, getSlaBucketIndonesiaWorkingDays } from '@/utils/indoBusinessDays'
import { isFptkClosedByCurrentStatus } from '@/utils/fptkPositionStatus'

/** Minimal FPTK fields used for SLA / matrix aggregation on the dashboard. */
export type FptkMatrixJob = {
  id?: string
  title?: string | null
  position?: string | null
  department?: string | null
  division?: string | null
  areaDetail?: string | null
  area?: string | null
  location?: string | null
  urgentNormal?: string | null
  priority?: string | null
  fptkReceiveDate?: string | null
  requestDate?: string | null
  createdAt?: string | null
  currentStatus?: string | null
  status?: string | null
  closedAt?: string | null
}

export const SLA_BUCKET_LABELS = [
  '0-30 Days',
  '31-60 Days',
  '61-90 Days',
  'Above 91 Days',
] as const

export type SlaBucketLabel = (typeof SLA_BUCKET_LABELS)[number]

export const POSITION_PRIORITY_LABELS = ['P0', 'P1', 'P2'] as const

export type PositionPriorityLabel = (typeof POSITION_PRIORITY_LABELS)[number]

/** Division column key for matrix tables (department / division). */
export function getPositionDivision(job: {
  department?: string | null
  division?: string | null
}): string {
  const raw = (job.department || job.division || '').trim()
  return raw || 'Unknown'
}

/** P0 / P1 / P2 from urgentNormal or priority; OTHER when missing or unrecognized. */
export function getPositionPriority(job: {
  urgentNormal?: string | null
  priority?: string | null
}): PositionPriorityLabel | 'OTHER' {
  const value = (job.urgentNormal || job.priority || '').toString().toUpperCase().trim()
  if (value === 'P0' || value === 'P1' || value === 'P2') return value
  return 'OTHER'
}

export function getPositionLocationKey(job: {
  areaDetail?: string | null
  area?: string | null
  location?: string | null
}): string {
  return job.areaDetail || job.area || job.location || 'Unknown'
}

/**
 * SLA bucket from FPTK receive date (fallback requestDate, createdAt).
 * Frozen at closedAt when position is closed — same as Summary by Position.
 */
export function getPositionSlaBucket(
  job: {
    fptkReceiveDate?: string | null
    requestDate?: string | null
    createdAt?: string | null
    currentStatus?: string | null
    closedAt?: string | null
  },
  now = new Date()
): SlaBucketLabel | '-' {
  const referenceDate = job.fptkReceiveDate || job.requestDate || job.createdAt
  if (!referenceDate) return '-'

  const start = new Date(referenceDate)
  if (isNaN(start.getTime())) return '-'

  const isClosed = isFptkClosedByCurrentStatus(job.currentStatus)
  const closeAnchorRaw = isClosed ? job.closedAt || null : null
  const closeAnchorDate = closeAnchorRaw ? new Date(closeAnchorRaw) : null
  const slaEndDate =
    closeAnchorDate && !isNaN(closeAnchorDate.getTime()) ? closeAnchorDate : now

  return getSlaBucketIndonesiaWorkingDays(start, slaEndDate)
}

/** Working-day count for SLA display — same end-date rules as {@link getPositionSlaBucket}. */
export function getPositionSlaWorkingDays(
  job: {
    fptkReceiveDate?: string | null
    requestDate?: string | null
    createdAt?: string | null
    currentStatus?: string | null
    closedAt?: string | null
  },
  now = new Date()
): number | null {
  const referenceDate = job.fptkReceiveDate || job.requestDate || job.createdAt
  if (!referenceDate) return null

  const start = new Date(referenceDate)
  if (isNaN(start.getTime())) return null

  const isClosed = isFptkClosedByCurrentStatus(job.currentStatus)
  const closeAnchorRaw = isClosed ? job.closedAt || null : null
  const closeAnchorDate = closeAnchorRaw ? new Date(closeAnchorRaw) : null
  const slaEndDate =
    closeAnchorDate && !isNaN(closeAnchorDate.getTime()) ? closeAnchorDate : now

  return businessDaysDiffIndonesia(start, slaEndDate)
}
