'use client'

import { useMemo } from 'react'
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
import type { PositionStatusMatrixData } from '@/utils/positionStatusMatrix'

const SLA_ROW_DISPLAY: Record<SlaBucketLabel, string> = {
  '0-30 Days': '0–30',
  '31-60 Days': '31–60',
  '61-90 Days': '61–90',
  'Above 91 Days': '90+',
}

export type PositionMatrixListItem = {
  id: string
  kind: 'fptk'
  title: string
  subtitle: string
  meta: string
}

type Props = {
  data: PositionStatusMatrixData
  positions: FptkMatrixJob[]
  onClose: () => void
  onDrillDown: (title: string, items: PositionMatrixListItem[]) => void
}

function toListItem(job: FptkMatrixJob): PositionMatrixListItem | null {
  if (!job.id) return null
  return {
    id: job.id,
    kind: 'fptk',
    title: job.title || job.position || 'Unknown Position',
    subtitle: `${job.department || job.division || 'N/A'} • ${job.location ?? job.areaDetail ?? job.area ?? 'N/A'}`,
    meta: job.currentStatus || job.status || 'N/A',
  }
}

function filterPositionsForCell(
  positions: FptkMatrixJob[],
  location: string,
  division: string,
  kind: 'sla' | 'total' | 'priority',
  slaBucket?: SlaBucketLabel,
  priority?: (typeof POSITION_PRIORITY_LABELS)[number]
): PositionMatrixListItem[] {
  const scoped = positions.filter(
    (job) => getPositionLocationKey(job) === location && getPositionDivision(job) === division
  )

  const filtered = scoped.filter((job) => {
    if (kind === 'priority' && priority) {
      return (
        isFptkOpenByCurrentStatus(job.currentStatus) && getPositionPriority(job) === priority
      )
    }
    if (kind === 'sla' && slaBucket) {
      return getPositionSlaBucket(job) === slaBucket
    }
    if (kind === 'total') {
      const bucket = getPositionSlaBucket(job)
      return bucket !== '-' && SLA_BUCKET_LABELS.includes(bucket)
    }
    return false
  })

  return filtered.map(toListItem).filter((x): x is PositionMatrixListItem => x !== null)
}

export default function PositionStatusMatrixModal({
  data,
  positions,
  onClose,
  onDrillDown,
}: Props) {
  const hasDivisions = data.divisions.length > 0

  const handleCell = (
    title: string,
    division: string,
    kind: 'sla' | 'total' | 'priority',
    slaBucket?: SlaBucketLabel,
    priority?: (typeof POSITION_PRIORITY_LABELS)[number]
  ) => {
    const items = filterPositionsForCell(
      positions,
      data.location,
      division,
      kind,
      slaBucket,
      priority
    )
    if (items.length > 0) onDrillDown(title, items)
  }

  const matrixSummary = useMemo(() => {
    const totalSla = Object.values(data.totals).reduce((a, b) => a + b, 0)
    const totalOpenPri = POSITION_PRIORITY_LABELS.reduce(
      (sum, p) => sum + Object.values(data.priority[p]).reduce((a, b) => a + b, 0),
      0
    )
    return { totalSla, totalOpenPri }
  }, [data])

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b flex items-start justify-between gap-4 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Position Status • {data.location}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              SLA by division (Indonesia working days, frozen when closed). Open positions by
              priority (P0, P1, P2).
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {matrixSummary.totalSla} with SLA data · {matrixSummary.totalOpenPri} open by priority
            </p>
          </div>
          <button
            type="button"
            className="text-gray-500 hover:text-gray-700 shrink-0"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="overflow-auto px-6 py-4 flex-1">
          {!hasDivisions ? (
            <p className="text-sm text-gray-500">No position data for this location.</p>
          ) : (
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="sticky left-0 z-10 bg-white text-left py-2 pr-4 font-medium text-gray-500 w-24">
                    {' '}
                  </th>
                  {data.divisions.map((d) => (
                    <th
                      key={d}
                      className="text-center py-2 px-3 font-semibold text-gray-700 whitespace-nowrap min-w-[4rem]"
                    >
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SLA_BUCKET_LABELS.map((row) => (
                  <tr key={row} className="border-b border-gray-100">
                    <td className="sticky left-0 z-10 bg-white py-2 pr-4 font-medium text-gray-700 whitespace-nowrap">
                      {SLA_ROW_DISPLAY[row]}
                    </td>
                    {data.divisions.map((d) => {
                      const count = data.sla[row][d] || 0
                      return (
                        <td key={d} className="text-center py-2 px-3">
                          {count > 0 ? (
                            <button
                              type="button"
                              className="text-indigo-700 font-medium hover:underline"
                              onClick={() =>
                                handleCell(`${SLA_ROW_DISPLAY[row]} • ${d}`, d, 'sla', row)
                              }
                            >
                              {count}
                            </button>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                <tr className="border-y-2 border-gray-300 bg-gray-50 font-semibold">
                  <td className="sticky left-0 z-10 bg-gray-50 py-2 pr-4 text-gray-900">Total</td>
                  {data.divisions.map((d) => {
                    const count = data.totals[d] || 0
                    return (
                      <td key={d} className="text-center py-2 px-3 text-gray-900">
                        {count > 0 ? (
                          <button
                            type="button"
                            className="hover:underline"
                            onClick={() => handleCell(`Total SLA • ${d}`, d, 'total')}
                          >
                            {count}
                          </button>
                        ) : (
                          '0'
                        )}
                      </td>
                    )
                  })}
                </tr>
                {POSITION_PRIORITY_LABELS.map((row) => (
                  <tr key={row} className="border-b border-gray-100">
                    <td className="sticky left-0 z-10 bg-white py-2 pr-4 font-medium text-gray-700">
                      {row}
                    </td>
                    {data.divisions.map((d) => {
                      const count = data.priority[row][d] || 0
                      return (
                        <td key={d} className="text-center py-2 px-3">
                          {count > 0 ? (
                            <button
                              type="button"
                              className="text-indigo-700 font-medium hover:underline"
                              onClick={() =>
                                handleCell(`${row} open • ${d}`, d, 'priority', undefined, row)
                              }
                            >
                              {count}
                            </button>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-4 border-t flex justify-end shrink-0">
          <button
            type="button"
            className="px-4 py-2 text-sm rounded-md border text-gray-700 bg-white hover:bg-gray-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
