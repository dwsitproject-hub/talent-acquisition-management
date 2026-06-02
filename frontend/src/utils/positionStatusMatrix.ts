import { isFptkOpenByCurrentStatus } from '@/utils/fptkPositionStatus'
import {
  getPositionDivision,
  getPositionLocationKey,
  getPositionPriority,
  getPositionSlaBucket,
  POSITION_PRIORITY_LABELS,
  SLA_BUCKET_LABELS,
  type FptkMatrixJob,
  type SlaBucketLabel,
} from '@/utils/positionSla'

export type DivisionCounts = Record<string, number>

export type PositionStatusMatrixData = {
  location: string
  divisions: string[]
  sla: Record<SlaBucketLabel, DivisionCounts>
  totals: DivisionCounts
  priority: Record<(typeof POSITION_PRIORITY_LABELS)[number], DivisionCounts>
}

function emptyDivisionCounts(divisions: string[]): DivisionCounts {
  return Object.fromEntries(divisions.map((d) => [d, 0]))
}

export function buildPositionStatusMatrix(
  positions: FptkMatrixJob[],
  locationKey: string
): PositionStatusMatrixData {
  const scoped = positions.filter((job) => getPositionLocationKey(job) === locationKey)

  const divisionSet = new Set<string>()
  scoped.forEach((job) => divisionSet.add(getPositionDivision(job)))
  const divisions = Array.from(divisionSet).sort((a, b) => a.localeCompare(b))

  const sla = Object.fromEntries(
    SLA_BUCKET_LABELS.map((row) => [row, emptyDivisionCounts(divisions)])
  ) as PositionStatusMatrixData['sla']

  const priority = Object.fromEntries(
    POSITION_PRIORITY_LABELS.map((row) => [row, emptyDivisionCounts(divisions)])
  ) as PositionStatusMatrixData['priority']

  const totals = emptyDivisionCounts(divisions)

  for (const job of scoped) {
    const div = getPositionDivision(job)
    const bucket = getPositionSlaBucket(job)
    if (bucket !== '-' && bucket in sla) {
      sla[bucket][div] += 1
    }

    if (isFptkOpenByCurrentStatus(job.currentStatus)) {
      const pri = getPositionPriority(job)
      if (pri !== 'OTHER' && pri in priority) {
        priority[pri][div] += 1
      }
    }
  }

  for (const d of divisions) {
    totals[d] = SLA_BUCKET_LABELS.reduce((sum, row) => sum + (sla[row][d] || 0), 0)
  }

  return { location: locationKey, divisions, sla, totals, priority }
}
