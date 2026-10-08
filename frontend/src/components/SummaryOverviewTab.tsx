"use client"

import { useMemo, useState } from 'react'
import {
  OPEN_SLA_BUCKETS,
  OVERVIEW_DIMENSION_LABEL,
  buildOverviewGroups,
  buildVacancyTrend,
  matchesOverviewSelection,
  type OpenSlaBucket,
  type OverviewDimension,
  type OverviewGroup,
  type OverviewMetric,
  type OverviewSelection,
  type OverviewSourceRow,
} from '@/utils/summaryOverview'

const DEFAULT_ROW_LIMIT = 10

// `text` is the in-bar number color, chosen for ≥4.5:1 contrast on `bar`.
const CLOSED_SEGMENT = { label: 'Closed', bar: 'bg-slate-500', text: 'text-white' }

const OPEN_SEGMENTS: Record<OpenSlaBucket, { label: string; bar: string; text: string }> = {
  '0-30 Days': { label: 'Open · SLA 0–30 days', bar: 'bg-green-500', text: 'text-gray-900' },
  '31-60 Days': { label: 'Open · 31–60 days', bar: 'bg-yellow-400', text: 'text-gray-900' },
  '61-90 Days': { label: 'Open · 61–90 days', bar: 'bg-orange-500', text: 'text-gray-900' },
  'Above 91 Days': { label: 'Open · > 90 days', bar: 'bg-red-600', text: 'text-white' },
  none: { label: 'Open · no start date', bar: 'bg-gray-300', text: 'text-gray-900' },
}

/** Narrowest a segment may get so its number stays readable. */
const MIN_SEGMENT_REM = 1.75

const CHARTS: { dimension: OverviewDimension; title: string; noun: [string, string] }[] = [
  { dimension: 'site', title: 'Vacancies per Site (PT)', noun: ['site', 'sites'] },
  { dimension: 'division', title: 'Vacancies per Division', noun: ['division', 'divisions'] },
  { dimension: 'hm', title: 'Vacancies per Hiring Manager', noun: ['hiring manager', 'hiring managers'] },
]

const ROW_GRID =
  'grid grid-cols-[minmax(9rem,13rem)_minmax(14rem,1fr)_4.5rem_9rem_4.5rem_5.5rem] items-center gap-3'

function formatDays(days: number | null): string {
  return days == null ? '—' : `${days} d`
}

/**
 * Closed | Open-by-SLA stacked bar with each segment's number printed inside.
 * The bar's overall length is proportional to the group total; inside it,
 * segments share space by value but never shrink below MIN_SEGMENT_REM, so
 * small counts stay legible (proportions bend slightly for tiny segments).
 */
function SegmentedBar({ group, max }: { group: OverviewGroup; max: number }) {
  const segments = [
    ...(group.closed > 0 ? [{ key: 'closed', value: group.closed, ...CLOSED_SEGMENT }] : []),
    ...OPEN_SLA_BUCKETS.filter((b) => group.openByBucket[b] > 0).map((b) => ({
      key: b,
      value: group.openByBucket[b],
      ...OPEN_SEGMENTS[b],
    })),
  ]
  const total = group.closed + group.open
  return (
    <span className="flex h-5 rounded-sm bg-gray-100 overflow-hidden" aria-hidden="true">
      <span
        className="flex h-full"
        style={{
          width: `${max > 0 ? (total / max) * 100 : 0}%`,
          minWidth: `${segments.length * MIN_SEGMENT_REM}rem`,
        }}
      >
        {segments.map((s) => (
          <span
            key={s.key}
            className={`flex h-full items-center justify-center text-[11px] font-semibold leading-none tabular-nums ${s.bar} ${s.text} ${
              s.key === 'closed' && group.open > 0 ? 'mr-0.5' : ''
            }`}
            style={{ flex: `${s.value} 1 0`, minWidth: `${MIN_SEGMENT_REM}rem` }}
          >
            {s.value}
          </span>
        ))}
      </span>
    </span>
  )
}

function describeGroup(g: OverviewGroup, unit: string): string {
  const buckets = OPEN_SLA_BUCKETS.filter((b) => g.openByBucket[b] > 0)
    .map((b) => `${OPEN_SEGMENTS[b].label}: ${g.openByBucket[b]}`)
    .join(', ')
  return `${g.name} — ${unit}: closed ${g.closed}, open ${g.open}${buckets ? ` (${buckets})` : ''}`
}

function OverviewChart({
  dimension,
  title,
  noun,
  rows,
  metric,
  selection,
  onSelect,
  onViewDetail,
}: {
  dimension: OverviewDimension
  title: string
  noun: [string, string]
  rows: OverviewSourceRow[]
  metric: OverviewMetric
  selection: OverviewSelection | null
  onSelect: (sel: OverviewSelection | null) => void
  onViewDetail: () => void
}) {
  const [showAll, setShowAll] = useState(false)
  const unit = metric === 'headcount' ? 'headcount' : 'positions'

  // A selection made in another chart filters this one; a selection in this
  // chart keeps every group visible and just highlights the chosen one.
  const groups = useMemo(() => {
    const scoped =
      selection && selection.dimension !== dimension
        ? rows.filter((r) => matchesOverviewSelection(r, selection))
        : rows
    return buildOverviewGroups(scoped, dimension, metric)
  }, [rows, dimension, metric, selection])

  const selectedHere = selection?.dimension === dimension ? selection.value : null
  const limited = showAll ? groups : groups.slice(0, DEFAULT_ROW_LIMIT)
  // Keep a selected group visible even when it falls outside the top N.
  const visible =
    selectedHere && !limited.some((g) => g.name === selectedHere)
      ? [...limited, ...groups.filter((g) => g.name === selectedHere)]
      : limited
  const max = Math.max(0, ...visible.map((g) => g.closed + g.open))
  const hiddenCount = groups.length - limited.length

  return (
    <section className="bg-white shadow rounded-lg p-4 sm:p-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <span className="text-xs text-gray-500">
          {unit} · closed vs open{dimension === 'hm' && !showAll ? ` · top ${DEFAULT_ROW_LIMIT}` : ''}
        </span>
      </div>

      {groups.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">No positions match the current filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[56rem] flex flex-col gap-1">
            <div
              className={`${ROW_GRID} px-1.5 pb-1.5 border-b border-gray-100 text-[11px] font-medium uppercase tracking-wider text-gray-500`}
            >
              <span>{OVERVIEW_DIMENSION_LABEL[dimension]}</span>
              <span>Closed | Open (open stacked by current SLA)</span>
              <span className="text-right">Closed</span>
              <span
                className="text-right"
                title="Average Indonesia working days (weekends &amp; national holidays excluded) from application to offer acceptance, across the hires in brackets"
              >
                Avg applied → offer accepted
              </span>
              <span className="text-right">Open</span>
              <span className="text-right">Total vacancies</span>
            </div>
            {visible.map((g) => {
              const isSelected = selectedHere === g.name
              const dimmed = selectedHere != null && !isSelected
              return (
                <button
                  key={g.name}
                  type="button"
                  aria-pressed={isSelected}
                  title={describeGroup(g, unit)}
                  onClick={() => onSelect(isSelected ? null : { dimension, value: g.name })}
                  className={[
                    ROW_GRID,
                    'w-full min-h-[36px] px-1.5 py-1 rounded-md border text-left transition',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                    isSelected ? 'bg-indigo-50 border-indigo-400' : 'border-transparent hover:bg-gray-50',
                    dimmed ? 'opacity-45' : '',
                  ].join(' ')}
                >
                  <span className="truncate text-sm text-gray-900">{g.name}</span>
                  <SegmentedBar group={g} max={max} />
                  <span className="text-right text-sm tabular-nums text-slate-700">{g.closed}</span>
                  <span className="text-right text-sm tabular-nums text-slate-700">
                    {formatDays(g.avgTimeToOfferDays)}
                    {g.hires > 0 && (
                      <span className="ml-1 text-xs text-gray-500">
                        ({g.hires} {g.hires === 1 ? 'hire' : 'hires'})
                      </span>
                    )}
                  </span>
                  <span className="text-right text-sm font-semibold tabular-nums text-gray-900">{g.open}</span>
                  <span className="text-right text-sm font-semibold tabular-nums text-gray-900">
                    {g.closed + g.open}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-dashed border-gray-200 text-xs text-gray-500">
        <span>
          {groups.length} {groups.length === 1 ? noun[0] : noun[1]} · sorted by open, then oldest SLA
          {hiddenCount > 0 && !showAll && (
            <button type="button" onClick={() => setShowAll(true)} className="ml-2 text-indigo-600 hover:underline">
              Show all {groups.length}
            </button>
          )}
          {showAll && groups.length > DEFAULT_ROW_LIMIT && (
            <button type="button" onClick={() => setShowAll(false)} className="ml-2 text-indigo-600 hover:underline">
              Show top {DEFAULT_ROW_LIMIT}
            </button>
          )}
        </span>
        <button type="button" onClick={onViewDetail} className="min-h-[32px] text-indigo-600 hover:underline">
          View positions in Detail →
        </button>
      </div>
    </section>
  )
}

function VacancyTrend({
  rows,
  metric,
  selection,
}: {
  rows: OverviewSourceRow[]
  metric: OverviewMetric
  selection: OverviewSelection | null
}) {
  const months = useMemo(
    () => buildVacancyTrend(rows.filter((r) => matchesOverviewSelection(r, selection)), metric),
    [rows, metric, selection]
  )
  const max = Math.max(1, ...months.flatMap((m) => [m.opened, m.filled]))
  const unit = metric === 'headcount' ? 'headcount' : 'positions'
  const filledHint =
    metric === 'headcount' ? 'filled = hires by offer-acceptance month' : 'filled = positions by first offer acceptance'

  return (
    <section className="bg-white shadow rounded-lg p-4 sm:p-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-gray-900">Vacancy trend (opened vs filled per month)</h2>
        <span className="text-xs text-gray-500">
          {unit} · last 12 months · {filledHint}
        </span>
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-gray-400" /> Opened
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-indigo-500" /> Filled
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[40rem]">
          <div className="grid grid-cols-12 gap-2 items-end h-44 px-1 border-b border-gray-300">
            {months.map((m) => (
              <div
                key={m.key}
                className="flex items-end justify-center gap-1 h-full"
                title={`${m.label}: opened ${m.opened}, filled ${m.filled}`}
              >
                {(['opened', 'filled'] as const).map((field) => (
                  <div key={field} className="flex flex-col items-center justify-end h-full flex-1 max-w-[1.5rem]">
                    <span className="text-[10px] tabular-nums text-gray-500">{m[field] || ''}</span>
                    <span
                      className={`block w-full rounded-t-sm ${field === 'opened' ? 'bg-gray-400' : 'bg-indigo-500'}`}
                      style={{ height: `${(m[field] / max) * 85}%` }}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-12 gap-2 pt-1 text-center text-[11px] text-gray-500">
            {months.map((m) => (
              <span key={m.key}>{m.label}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default function SummaryOverviewTab({
  rows,
  metric,
  selection,
  onSelect,
  onViewDetail,
}: {
  /** Rows after the page filters, before the cross-filter selection. */
  rows: OverviewSourceRow[]
  metric: OverviewMetric
  selection: OverviewSelection | null
  onSelect: (sel: OverviewSelection | null) => void
  onViewDetail: () => void
}) {
  const hasNoDate = rows.some((r) => r.sla === '-')
  const legendBuckets = OPEN_SLA_BUCKETS.filter((b) => b !== 'none' || hasNoDate)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-600">
        <span className="font-semibold text-gray-900">Bars:</span>
        <span className="inline-flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded-sm ${CLOSED_SEGMENT.bar}`} /> {CLOSED_SEGMENT.label}
        </span>
        {legendBuckets.map((b) => (
          <span key={b} className="inline-flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded-sm ${OPEN_SEGMENTS[b].bar}`} /> {OPEN_SEGMENTS[b].label}
          </span>
        ))}
        <span className="sm:ml-auto text-gray-400">Click a row to cross-filter the other charts</span>
      </div>

      {CHARTS.map((c) => (
        <OverviewChart
          key={c.dimension}
          {...c}
          rows={rows}
          metric={metric}
          selection={selection}
          onSelect={onSelect}
          onViewDetail={onViewDetail}
        />
      ))}

      <VacancyTrend rows={rows} metric={metric} selection={selection} />
    </div>
  )
}
