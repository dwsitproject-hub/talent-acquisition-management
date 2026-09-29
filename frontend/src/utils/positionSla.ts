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
  /** Earliest offer-acceptance timestamp for this FPTK (from API when available). */
  offerAcceptedAt?: string | null
}

/** Application statuses at or after offer acceptance — SLA stops from the earliest. */
export const OFFER_ACCEPTANCE_SLA_FREEZE_STATUSES = [
  'OFFER_ACCEPTED',
  'MEDICAL_CHECKUP_SCHEDULED',
  'MEDICAL_CHECKUP_COMPLETED',
  'CONTRACT_SENT',
  'CONTRACT_SIGNED',
  'ONBOARDING',
  'HIRED',
] as const

export function isOfferAcceptanceSlaFreezeStatus(status?: string | null): boolean {
  const raw = (status || '').toString().toUpperCase().trim()
  return (OFFER_ACCEPTANCE_SLA_FREEZE_STATUSES as readonly string[]).includes(raw)
}

function resolveSlaEndDate(
  job: {
    currentStatus?: string | null
    closedAt?: string | null
    offerAcceptedAt?: string | null
  },
  now: Date
): Date {
  const candidates: Date[] = []

  const offerRaw = job.offerAcceptedAt ?? null
  if (offerRaw) {
    const offerDate = new Date(offerRaw)
    if (!isNaN(offerDate.getTime())) candidates.push(offerDate)
  }

  if (isFptkClosedByCurrentStatus(job.currentStatus)) {
    const closeRaw = job.closedAt ?? null
    if (closeRaw) {
      const closeDate = new Date(closeRaw)
      if (!isNaN(closeDate.getTime())) candidates.push(closeDate)
    } else {
      candidates.push(now)
    }
  }

  if (candidates.length === 0) return now
  const minTime = Math.min(...candidates.map((d) => d.getTime()))
  return new Date(minTime)
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
 * Frozen at offer acceptance and/or closedAt when applicable.
 */
export function getPositionSlaBucket(
  job: {
    fptkReceiveDate?: string | null
    requestDate?: string | null
    createdAt?: string | null
    currentStatus?: string | null
    closedAt?: string | null
    offerAcceptedAt?: string | null
  },
  now = new Date()
): SlaBucketLabel | '-' {
  const referenceDate = job.fptkReceiveDate || job.requestDate || job.createdAt
  if (!referenceDate) return '-'

  const start = new Date(referenceDate)
  if (isNaN(start.getTime())) return '-'

  const slaEndDate = resolveSlaEndDate(job, now)
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
    offerAcceptedAt?: string | null
  },
  now = new Date()
): number | null {
  const referenceDate = job.fptkReceiveDate || job.requestDate || job.createdAt
  if (!referenceDate) return null

  const start = new Date(referenceDate)
  if (isNaN(start.getTime())) return null

  const slaEndDate = resolveSlaEndDate(job, now)
  return businessDaysDiffIndonesia(start, slaEndDate)
}
