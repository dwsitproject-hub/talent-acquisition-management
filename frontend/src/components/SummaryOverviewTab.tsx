"use client"

import { useMemo, useState } from 'react'
import {
  OPEN_SLA_BUCKETS,
  OVERVIEW_DIMENSION_LABEL,
  buildOverviewGroups,
  buildVacancyTrend,
  OVERVIEW_STATUS_OPTIONS,
  type OpenSlaBucket,
  type OverviewDimension,
  type OverviewGroup,
  type OverviewMetric,
  type OverviewSegment,
  type OverviewSelection,
  type OverviewStatusFilter,
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
 * Each segment is its own button: it opens Detail for that group and segment.
 */
function SegmentedBar({
  group,
  max,
  onSegmentClick,
}: {
  group: OverviewGroup
  max: number
  onSegmentClick: (segment: OverviewSegment) => void
}) {
  const segments: { key: OverviewSegment; value: number; label: string; bar: string; text: string }[] = [
    ...(group.closed > 0 ? [{ key: 'closed' as const, value: group.closed, ...CLOSED_SEGMENT }] : []),
    ...OPEN_SLA_BUCKETS.filter((b) => group.openByBucket[b] > 0).map((b) => ({
      key: b,
      value: group.openByBucket[b],
      ...OPEN_SEGMENTS[b],
    })),
  ]
  const total = group.closed + group.open
  return (
    <span className="flex h-6 rounded-sm bg-gray-100 overflow-hidden">
      <span
        className="flex h-full"
        style={{
          width: `${max > 0 ? (total / max) * 100 : 0}%`,
          minWidth: `${segments.length * MIN_SEGMENT_REM}rem`,
        }}
      >
        {segments.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onSegmentClick(s.key)
            }}
            title={`${s.label}: ${s.value} — click to see these positions in Detail`}
            aria-label={`${group.name}, ${s.label}: ${s.value}. View these positions in Detail`}
            className={[
              'flex h-full items-center justify-center text-[11px] font-semibold leading-none tabular-nums',
              'cursor-pointer transition hover:brightness-90 hover:ring-2 hover:ring-inset hover:ring-gray-900/40',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-700',
              s.bar,
              s.text,
              s.key === 'closed' && group.open > 0 ? 'mr-0.5' : '',
            ].join(' ')}
            style={{ flex: `${s.value} 1 0`, minWidth: `${MIN_SEGMENT_REM}rem` }}
          >
            {s.value}
          </button>
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
  onDrillDown,
  onViewDetail,
}: {
  dimension: OverviewDimension
  title: string
  noun: [string, string]
  rows: OverviewSourceRow[]
  metric: OverviewMetric
  onDrillDown: (sel: OverviewSelection, segment?: OverviewSegment) => void
  onViewDetail: () => void
}) {
  const [showAll, setShowAll] = useState(false)
  const unit = metric === 'headcount' ? 'headcount' : 'positions'

  const groups = useMemo(() => buildOverviewGroups(rows, dimension, metric), [rows, dimension, metric])
  const visible = showAll ? groups : groups.slice(0, DEFAULT_ROW_LIMIT)
  const max = Math.max(0, ...visible.map((g) => g.closed + g.open))
  const hiddenCount = groups.length - visible.length

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
            {visible.map((g) => (
              // Mouse users can click anywhere on the row; keyboard users get
              // the name button (whole group) and one button per bar segment.
              <div
                key={g.name}
                onClick={() => onDrillDown({ dimension, value: g.name })}
                title={describeGroup(g, unit)}
                className={[
                  ROW_GRID,
                  'w-full min-h-[36px] px-1.5 py-1 rounded-md border border-transparent cursor-pointer transition',
                  'hover:bg-indigo-50 hover:border-indigo-200',
                ].join(' ')}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDrillDown({ dimension, value: g.name })
                  }}
                  aria-label={`${g.name}: view all positions in Detail`}
                  className="truncate text-left text-sm text-gray-900 hover:text-indigo-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-sm"
                >
                  {g.name}
                </button>
                <SegmentedBar
                  group={g}
                  max={max}
                  onSegmentClick={(segment) => onDrillDown({ dimension, value: g.name }, segment)}
                />
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
              </div>
            ))}
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

/*
 * The plot is split into two bands so the cumulative line's labels never sit
 * on the monthly bars or their numbers:
 *   - bars (plus their value labels) grow from the bottom, up to TREND_BAR_SCALE % of the height;
 *   - the line lives between TREND_LINE_TOP % and TREND_LINE_BOTTOM % from the top.
 * The gap between the two bands absorbs the bar labels and the line's dots.
 */
const TREND_BAR_SCALE = 48
const TREND_LINE_TOP = 12
const TREND_LINE_BOTTOM = 38

function VacancyTrend({
  rows,
  metric,
  monthCount,
}: {
  rows: OverviewSourceRow[]
  metric: OverviewMetric
  monthCount: number
}) {
  const months = useMemo(
    () => buildVacancyTrend(rows, metric, new Date(), monthCount),
    [rows, metric, monthCount]
  )
  const n = months.length
  const barMax = Math.max(1, ...months.flatMap((m) => [m.opened, m.filled]))
  // Bars and the cumulative line use separate scales: the running total
  // quickly outgrows any single month. The net can go negative (hires filling
  // vacancies opened before the window), so the line scale spans min…max.
  const netValues = months.map((m) => m.cumulativeNet)
  const netMin = Math.min(0, ...netValues)
  const netMax = Math.max(netMin + 1, ...netValues)
  const point = (i: number) => ({
    x: ((i + 0.5) / n) * 100,
    y:
      TREND_LINE_BOTTOM -
      ((months[i].cumulativeNet - netMin) / (netMax - netMin)) * (TREND_LINE_BOTTOM - TREND_LINE_TOP),
  })
  const columns = { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }
  const unit = metric === 'headcount' ? 'headcount' : 'positions'
  const filledHint =
    metric === 'headcount' ? 'filled = hires by offer-acceptance month' : 'filled = positions by first offer acceptance'
  const period = n > 0 ? `${months[0].fullLabel} – ${months[n - 1].fullLabel}` : ''

  return (
    <section className="bg-white shadow rounded-lg p-4 sm:p-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-gray-900">Vacancy trend (opened vs filled per month)</h2>
        <span className="text-xs text-gray-500">
          {unit} · {period} · {filledHint}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-gray-400" /> Opened
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-indigo-500" /> Filled
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="relative h-3 w-5">
            <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-teal-600" />
            <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-600" />
          </span>
          Cumulative open (opened − filled)
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[40rem] pt-4">
          <div className="relative h-64 border-b border-gray-300">
            {/* Monthly bars */}
            <div className="absolute inset-0 grid" style={columns}>
              {months.map((m) => (
                <div
                  key={m.key}
                  className="flex items-end justify-center gap-1 h-full px-1"
                  title={`${m.fullLabel}: opened ${m.opened}, filled ${m.filled}, cumulative open ${m.cumulativeNet}`}
                >
                  {(['opened', 'filled'] as const).map((field) => (
                    <div key={field} className="flex flex-col items-center justify-end h-full flex-1 max-w-[1.5rem]">
                      <span className="text-[10px] tabular-nums text-gray-500">{m[field] || ''}</span>
                      <span
                        className={`block w-full rounded-t-sm ${field === 'opened' ? 'bg-gray-400' : 'bg-indigo-500'}`}
                        style={{ height: `${(m[field] / barMax) * TREND_BAR_SCALE}%` }}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Cumulative net open (opened − filled) line */}
            <svg
              className="absolute inset-0 h-full w-full overflow-visible pointer-events-none text-teal-600"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polyline
                points={months.map((_, i) => `${point(i).x},${point(i).y}`).join(' ')}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {months.map((m, i) => {
              const { x, y } = point(i)
              return (
                <span key={m.key} className="pointer-events-none" aria-hidden="true">
                  <span
                    className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-600 ring-2 ring-white"
                    style={{ left: `${x}%`, top: `${y}%` }}
                  />
                  <span
                    className="absolute -translate-x-1/2 -translate-y-[calc(100%+7px)] rounded bg-white/85 px-1 text-[11px] font-semibold leading-tight tabular-nums text-teal-700"
                    style={{ left: `${x}%`, top: `${y}%` }}
                  >
                    {m.cumulativeNet}
                  </span>
                </span>
              )
            })}
          </div>
          <div className="grid pt-1 text-center text-[11px] text-gray-500" style={columns}>
            {months.map((m) => (
              <span key={m.key}>{m.label}</span>
            ))}
          </div>
          {/* Screen-reader table of the same numbers */}
          <table className="sr-only">
            <caption>Vacancy trend per month</caption>
            <thead>
              <tr>
                <th>Month</th>
                <th>Opened</th>
                <th>Filled</th>
                <th>Cumulative open (opened − filled)</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.key}>
                  <td>{m.fullLabel}</td>
                  <td>{m.opened}</td>
                  <td>{m.filled}</td>
                  <td>{m.cumulativeNet}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export default function SummaryOverviewTab({
  rows,
  metric,
  status,
  onStatusChange,
  onDrillDown,
  onViewDetail,
  trendMonths,
}: {
  /** Rows after the page filters and the Position status filter. */
  rows: OverviewSourceRow[]
  metric: OverviewMetric
  status: OverviewStatusFilter
  onStatusChange: (status: OverviewStatusFilter) => void
  /** Row / bar-segment click: open Detail scoped to that group (and segment). */
  onDrillDown: (sel: OverviewSelection, segment?: OverviewSegment) => void
  onViewDetail: () => void
  /** Months shown in the vacancy trend (follows the Request date filter). */
  trendMonths: number
}) {
  const hasNoDate = rows.some((r) => r.sla === '-')
  const legendBuckets =
    status === 'closed' ? [] : OPEN_SLA_BUCKETS.filter((b) => b !== 'none' || hasNoDate)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span id="overview-status-label" className="text-xs font-medium text-gray-500">
          Position status
        </span>
        <div
          role="group"
          aria-labelledby="overview-status-label"
          className="inline-flex rounded-md border border-gray-300 bg-white shadow-sm overflow-hidden text-sm font-medium"
        >
          {OVERVIEW_STATUS_OPTIONS.map((opt, i) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onStatusChange(opt.id)}
              aria-pressed={status === opt.id}
              className={[
                'min-h-[36px] px-4 transition-colors',
                i > 0 ? 'border-l border-gray-300' : '',
                status === opt.id ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-50',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400">Closed = Close · Cancel · Internal Movement</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-600">
        <span className="font-semibold text-gray-900">Bars:</span>
        {status !== 'open' && (
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded-sm ${CLOSED_SEGMENT.bar}`} /> {CLOSED_SEGMENT.label}
          </span>
        )}
        {legendBuckets.map((b) => (
          <span key={b} className="inline-flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded-sm ${OPEN_SEGMENTS[b].bar}`} /> {OPEN_SEGMENTS[b].label}
          </span>
        ))}
        <span className="sm:ml-auto text-gray-400">Click a row, or a bar segment, to open those positions in Detail</span>
      </div>

      {CHARTS.map((c) => (
        <OverviewChart
          key={c.dimension}
          {...c}
          rows={rows}
          metric={metric}
          onDrillDown={onDrillDown}
          onViewDetail={onViewDetail}
        />
      ))}

      <VacancyTrend rows={rows} metric={metric} monthCount={trendMonths} />
    </div>
  )
}
