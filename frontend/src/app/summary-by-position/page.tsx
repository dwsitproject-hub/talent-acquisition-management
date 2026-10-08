"use client"

import {
  Fragment,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type WheelEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import Layout from '@/components/Layout/Layout'
import PositionEditOverlay from '@/components/PositionEditOverlay'
import PositionCandidatePipelineModal from '@/components/PositionCandidatePipelineModal'
import { FPTKAPI } from '@/lib/api'
import MultiSelectDropdown from '@/components/MultiSelectDropdown'
import { usePositionEditOverlay } from '@/hooks/usePositionEditOverlay'
import {
  displayFptkCurrentStatus,
  isFptkClosedByCurrentStatus,
  isFptkOpenByCurrentStatus,
} from '@/utils/fptkPositionStatus'
import { getPositionSlaWorkingDays } from '@/utils/positionSla'
import {
  getApplicationStatusPillClass,
  getLatestPipelineProgress,
  type LatestPipelineProgress,
} from '@/utils/applicationStatusUi'
import {
  ExclamationCircleIcon,
  AdjustmentsHorizontalIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  InformationCircleIcon,
  PencilSquareIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import Spinner from '@/components/Spinner'
import {
  SUMMARY_PIPELINE_COLUMNS,
  emptySummaryPipelineCounts,
  getSummaryPipelineColumnBadgeClass,
  type SummaryPipelineColumnKey,
  type SummaryPipelineCounts,
} from '@/utils/summaryByPositionColumns'
import SummaryOverviewTab from '@/components/SummaryOverviewTab'
import {
  OVERDUE_SLA_BUCKET,
  OVERVIEW_DIMENSION_LABEL,
  REQUEST_DATE_RANGE_OPTIONS,
  compareGroupNames,
  divisionLabel,
  formatSiteLabel,
  matchesOverviewSelection,
  matchesRequestDateRange,
  requestDateCutoff,
  type OverviewSelection,
  type RequestDateRange,
  type TimeToOfferStats,
} from '@/utils/summaryOverview'

interface OnboardingCandidate {
  name: string
  joinDate: string | null
}

interface SummaryRow {
  id: string
  priority: string
  division: string
  pt: string
  area: string
  location: string
  section: string
  position: string
  currentStatus: string
  statusFktk: string
  remark: string
  sla: string
  slaDays: number | null
  hiringManager: string
  summaryCounts: SummaryPipelineCounts
  onboardingCandidates: OnboardingCandidate[]
  latestPipeline: LatestPipelineProgress | null
  totalRequest: number | null
  timeToOffer: TimeToOfferStats | null
  offerAcceptedAt: string | null
  referenceDate: string | null
}

function hiringManagerMatches(rowHm: string, selected: string[]): boolean {
  if (selected.length === 0) return true
  const normalized = (rowHm || '').trim().toLowerCase()
  return selected.some(
    (hm) => hm.trim().toLowerCase() === normalized
  )
}

// Fixed columns: Position stacks division/section and area/location beneath the title.
const FIXED_SORT_KEYS: string[] = [
  'priority', 'position', 'sla', 'currentStatus',
]

function formatDivisionSectionLine(division: string, section: string): string | null {
  const div = division !== '-' ? division.trim() : ''
  const sec = section !== '-' ? section.trim() : ''
  if (div && sec) return `${div} > ${sec}`
  if (div) return div
  if (sec) return sec
  return null
}

function formatAreaLocationLine(area: string, location: string): string | null {
  const a = area !== '-' ? area.trim() : ''
  const loc = location !== '-' ? location.trim() : ''
  if (a && loc) return `${a} - ${loc}`
  if (a) return a
  if (loc) return loc
  return null
}


// ---------- Site (PT) → Division grouping ----------
interface GroupStats {
  key: string
  name: string
  positionCount: number
  openCount: number
  overdueCount: number
  totals: SummaryPipelineCounts
}

interface DivisionGroup extends GroupStats {
  rows: SummaryRow[]
}

interface SiteGroup extends GroupStats {
  divisions: DivisionGroup[]
}

function computeGroupStats(key: string, name: string, rows: SummaryRow[]): GroupStats {
  const totals = emptySummaryPipelineCounts()
  let openCount = 0
  let overdueCount = 0
  rows.forEach((r) => {
    ;(Object.keys(totals) as SummaryPipelineColumnKey[]).forEach((k) => {
      totals[k] = (totals[k] ?? 0) + (r.summaryCounts[k] ?? 0)
    })
    if (isFptkOpenByCurrentStatus(r.currentStatus)) openCount += 1
    if (r.sla === OVERDUE_SLA_BUCKET) overdueCount += 1
  })
  return { key, name, positionCount: rows.length, openCount, overdueCount, totals }
}

/** Groups already-sorted rows; row order inside each division follows the table sort. */
function buildSiteGroups(rows: SummaryRow[]): SiteGroup[] {
  const bySite = new Map<string, Map<string, SummaryRow[]>>()
  rows.forEach((r) => {
    const siteName = formatSiteLabel(r.location, r.pt)
    const divName = divisionLabel(r.division)
    if (!bySite.has(siteName)) bySite.set(siteName, new Map())
    const divMap = bySite.get(siteName)!
    if (!divMap.has(divName)) divMap.set(divName, [])
    divMap.get(divName)!.push(r)
  })
  return Array.from(bySite.keys())
    .sort(compareGroupNames)
    .map((siteName) => {
      const siteKey = `site:${siteName}`
      const divMap = bySite.get(siteName)!
      const divisions: DivisionGroup[] = Array.from(divMap.keys())
        .sort(compareGroupNames)
        .map((divName) => {
          const divRows = divMap.get(divName)!
          return {
            ...computeGroupStats(`${siteKey}::div:${divName}`, divName, divRows),
            rows: divRows,
          }
        })
      const siteRows = divisions.flatMap((d) => d.rows)
      return { ...computeGroupStats(siteKey, siteName, siteRows), divisions }
    })
}

type StatusCardKey = 'open' | 'closed'
type SlaCardKey = 'sla-0-30' | 'sla-31-60' | 'sla-61-90' | 'sla-91'
type SummaryCardKey = StatusCardKey | SlaCardKey

const STATUS_CARD_KEYS: StatusCardKey[] = ['open', 'closed']
const SLA_CARD_KEYS: SlaCardKey[] = ['sla-0-30', 'sla-31-60', 'sla-61-90', 'sla-91']

const CARD_CONFIG: Record<SummaryCardKey, {
  label: string
  sublabel: string
  color: string
  bg: string
  activeBg: string
  ring: string
  border: string
  dot: string
}> = {
  open: {
    label: 'Open Positions',
    sublabel: 'Active in pipeline',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    activeBg: 'bg-blue-100',
    ring: 'ring-blue-500',
    border: 'border-blue-300',
    dot: 'bg-blue-400',
  },
  closed: {
    label: 'Closed Positions',
    sublabel: 'Close · Cancel · Internal Movement',
    color: 'text-slate-600',
    bg: 'bg-slate-50',
    activeBg: 'bg-slate-100',
    ring: 'ring-slate-400',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
  },
  'sla-0-30': {
    label: 'SLA 0–30 Days',
    sublabel: 'On track',
    color: 'text-green-700',
    bg: 'bg-green-50',
    activeBg: 'bg-green-100',
    ring: 'ring-green-500',
    border: 'border-green-300',
    dot: 'bg-green-400',
  },
  'sla-31-60': {
    label: 'SLA 31–60 Days',
    sublabel: 'Monitor',
    color: 'text-yellow-700',
    bg: 'bg-yellow-50',
    activeBg: 'bg-yellow-100',
    ring: 'ring-yellow-500',
    border: 'border-yellow-300',
    dot: 'bg-yellow-400',
  },
  'sla-61-90': {
    label: 'SLA 61–90 Days',
    sublabel: 'At risk',
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    activeBg: 'bg-orange-100',
    ring: 'ring-orange-500',
    border: 'border-orange-300',
    dot: 'bg-orange-400',
  },
  'sla-91': {
    label: 'SLA > 91 Days',
    sublabel: 'Overdue',
    color: 'text-red-700',
    bg: 'bg-red-50',
    activeBg: 'bg-red-100',
    ring: 'ring-red-500',
    border: 'border-red-300',
    dot: 'bg-red-500',
  },
}

const SLA_BUCKET_TO_CARD_KEY: Record<string, SlaCardKey> = {
  '0-30 Days': 'sla-0-30',
  '31-60 Days': 'sla-31-60',
  '61-90 Days': 'sla-61-90',
  'Above 91 Days': 'sla-91',
}

/**
 * Hero SLA badge — the persona's primary metric per position, so it's shown
 * as a prominent colored pill with the exact working-day count (not just the
 * bucket label), pinned right after the Position column.
 */
function SlaHeroBadge({ sla, slaDays }: { sla: string; slaDays: number | null }) {
  const cardKey = SLA_BUCKET_TO_CARD_KEY[sla]
  if (!cardKey) return <span className="text-gray-400 text-xs">—</span>
  const cfg = CARD_CONFIG[cardKey]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${cfg.bg} ${cfg.color} ${cfg.border}`}
      title={`${sla} · ${cfg.sublabel}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot} shrink-0`} />
      {slaDays != null ? `${slaDays}d` : sla} · {cfg.sublabel}
    </span>
  )
}

/** Combines Current Status + latest stepper + Status FKTK + Remark into one compact cell. */
function StatusCell({
  currentStatus,
  statusFktk,
  remark,
  latestPipeline,
}: {
  currentStatus: string
  statusFktk: string
  remark: string
  latestPipeline: LatestPipelineProgress | null
}) {
  const hasRemark = Boolean(remark) && remark !== '-'
  const isReceived = statusFktk.trim().toLowerCase() === 'received'
  return (
    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
      <span className="truncate text-sm text-gray-900">{displayFptkCurrentStatus(currentStatus)}</span>
      {latestPipeline && (
        <span
          className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium"
          style={getApplicationStatusPillClass(latestPipeline.status)}
          title="Furthest active candidate in the hiring stepper"
        >
          {latestPipeline.status}
          {latestPipeline.count > 1 ? ` · ${latestPipeline.count}` : ''}
        </span>
      )}
      {statusFktk && statusFktk !== '-' && (
        <span
          className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
            isReceived ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {statusFktk}
        </span>
      )}
      {hasRemark && (
        <span title={remark} className="shrink-0 cursor-default text-gray-400 hover:text-gray-600">
          <InformationCircleIcon className="h-4 w-4" />
        </span>
      )}
    </div>
  )
}

/**
 * Badge + portal tooltip for the "Join dates" column.
 * Uses position:fixed rendered into document.body so the tooltip is never
 * clipped by the overflow-x-auto table wrapper.
 */
function JoinDatesCell({
  count,
  summaryCounts,
  onboardingCandidates,
}: {
  count: number
  summaryCounts: SummaryPipelineCounts
  onboardingCandidates: OnboardingCandidate[]
}) {
  const triggerRef = useRef<HTMLSpanElement>(null)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)

  const show = useCallback(() => {
    if (!triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    setCoords({ top: r.top, left: r.left + r.width / 2 })
  }, [])

  const hide = useCallback(() => setCoords(null), [])

  const totalApplied = summaryCounts.applied
  const totalInterview = summaryCounts.interview
  const totalRejectedWithdrawn =
    summaryCounts.rejectInterview + summaryCounts.withdrawn + summaryCounts.offerReject

  const badge =
    count === 0 ? (
      <span className="text-gray-300 text-xs">—</span>
    ) : (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getSummaryPipelineColumnBadgeClass('joinDates')}`}>
        {count}
      </span>
    )

  const formatJoinDate = (iso: string | null) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return isNaN(d.getTime())
      ? '—'
      : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        className="inline-block cursor-default"
      >
        {badge}
      </span>

      {coords &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[9999]"
            style={{
              top: coords.top - 8,
              left: coords.left,
              transform: 'translate(-50%, -100%)',
            }}
          >
            {/* Downward arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
            <div className="bg-gray-800 text-white rounded-lg shadow-xl p-3 w-52">
              <p className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider border-b border-gray-700 pb-1.5 mb-2">
                Position Summary
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-400 text-xs">Total Applied</span>
                  <span className="text-xs font-bold text-blue-300">{totalApplied}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-400 text-xs">Interview stage</span>
                  <span className="text-xs font-bold text-indigo-300">{totalInterview}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-400 text-xs">Rejected / Withdrawn</span>
                  <span className="text-xs font-bold text-red-400">{totalRejectedWithdrawn}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-400 text-xs">Join Date</span>
                  <span className="text-xs font-bold text-emerald-400">
                    {onboardingCandidates.length > 0
                      ? onboardingCandidates.map(c => formatJoinDate(c.joinDate)).join(', ')
                      : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

function LoadingSkeleton() {
  return (
    <Layout>
      <div className="space-y-6 animate-pulse">
        <div>
          <div className="h-8 w-64 bg-gray-200 rounded" />
          <div className="mt-2 h-4 w-96 bg-gray-100 rounded" />
        </div>
        <div className="bg-white shadow rounded-lg p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 rounded" />)}
        </div>
        <div className="space-y-3">
          <div className="h-4 w-32 bg-gray-100 rounded" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2].map(i => <div key={i} className="h-24 bg-white shadow rounded-xl" />)}
          </div>
          <div className="h-4 w-24 bg-gray-100 rounded mt-4" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-white shadow rounded-xl" />)}
          </div>
        </div>
        <div className="bg-white shadow rounded-lg p-6 space-y-3">
          <div className="h-8 bg-gray-100 rounded" />
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-10 bg-gray-50 rounded" />)}
        </div>
      </div>
    </Layout>
  )
}

const VALID_CARDS: SummaryCardKey[] = ['open', 'closed', 'sla-0-30', 'sla-31-60', 'sla-61-90', 'sla-91']

function initialActiveStatusCard(cardParam: string | null): StatusCardKey | null {
  if (cardParam && STATUS_CARD_KEYS.includes(cardParam as StatusCardKey)) {
    return cardParam as StatusCardKey
  }
  // Open positions are the default lens; SLA deep-links still scope to open unless ?card=closed.
  return 'open'
}

function slaSectionLabel(activeStatusCard: StatusCardKey | null): string {
  if (activeStatusCard === 'closed') return 'SLA health · closed positions'
  if (activeStatusCard === 'open') return 'SLA health · open positions'
  return 'SLA health · all positions'
}

type SummaryTab = 'overview' | 'detail'

function SummaryByPositionContent() {
  const searchParams = useSearchParams()
  const _locationParam = searchParams.get('location')
  const _cardParam = searchParams.get('card')
  const _tabParam = searchParams.get('tab')
  // Dashboard deep links (?location=…&card=…) land on Detail with every request
  // date included, so the counts match the dashboard tile that was clicked.
  const isDeepLink = Boolean(_locationParam || _cardParam)

  const [activeTab, setActiveTab] = useState<SummaryTab>(
    _tabParam === 'detail' || _tabParam === 'overview' ? _tabParam : isDeepLink ? 'detail' : 'overview'
  )
  const [requestDateRange, setRequestDateRange] = useState<RequestDateRange>(isDeepLink ? 'all' : '12m')
  const [crossFilter, setCrossFilter] = useState<OverviewSelection | null>(null)

  const [rows, setRows] = useState<SummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [priorityFilter, setPriorityFilter] = useState<string[]>([])
  const [divisionFilter, setDivisionFilter] = useState<string[]>([])
  const [locationFilter, setLocationFilter] = useState<string[]>(
    _locationParam ? [_locationParam] : []
  )
  const [sortKey, setSortKey] = useState<string>('position')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [activeStatusCard, setActiveStatusCard] = useState<StatusCardKey | null>(
    () => initialActiveStatusCard(_cardParam)
  )
  const [activeSlaCard, setActiveSlaCard] = useState<SlaCardKey | null>(
    _cardParam && SLA_CARD_KEYS.includes(_cardParam as SlaCardKey)
      ? (_cardParam as SlaCardKey)
      : null
  )
  const [areaFilter, setAreaFilter] = useState<string[]>([])
  const [statusFktkFilter, setStatusFktkFilter] = useState<string[]>([])
  const [hiringManagerFilter, setHiringManagerFilter] = useState<string[]>([])
  const [divisions, setDivisions] = useState<string[]>([])
  const [hiringManagers, setHiringManagers] = useState<string[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const [areaToLocations, setAreaToLocations] = useState<Record<string, string[]>>({})
  const [hiddenPipelineColumns, setHiddenPipelineColumns] = useState<Set<SummaryPipelineColumnKey>>(new Set())
  const [showColumnToggle, setShowColumnToggle] = useState(false)
  const [groupBySite, setGroupBySite] = useState(true)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const columnToggleRef = useRef<HTMLDivElement | null>(null)
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const hScrollBarRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const [tableScrollWidth, setTableScrollWidth] = useState(0)
  const [showHorizontalScrollBar, setShowHorizontalScrollBar] = useState(false)
  const [horizontalScrollLeft, setHorizontalScrollLeft] = useState(0)
  const hScrollSyncLock = useRef(false)

  const positionEdit = usePositionEditOverlay(() => {
    void loadSummaryData({ silent: true })
  })

  // Clicking a position row opens the candidate pipeline drill-down (Applied → Interview →
  // Offer Decision → Join Date), not the position edit modal. Editing is still available via
  // the small pencil icon next to the position title.
  const [candidatePipelineTarget, setCandidatePipelineTarget] = useState<
    { fptkId: string; positionLabel: string } | null
  >(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (columnToggleRef.current && !columnToggleRef.current.contains(e.target as Node)) {
        setShowColumnToggle(false)
      }
    }
    if (showColumnToggle) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showColumnToggle])

  useEffect(() => {
    loadSummaryData()
  }, [])

  const loadSummaryData = async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true)
      setError(null)
    } else {
      setRefreshing(true)
    }
    try {
      const payload = await FPTKAPI.getSummaryByPosition()
      const allJobPostings: any[] = payload?.fptks || []
      const summaryColumnCounts: Record<string, SummaryPipelineCounts> =
        payload?.summaryColumnCounts || {}
      const currentStatusesByFptkId: Record<string, string[]> = payload?.currentStatusesByFptkId || {}
      const totalApplicants: Record<string, number> = payload?.totalApplicants || {}
      const onboardingCandidatesMap: Record<string, OnboardingCandidate[]> = payload?.onboardingCandidates || {}
      const timeToOfferMap: Record<string, TimeToOfferStats> = payload?.timeToOffer || {}

      const result: SummaryRow[] = allJobPostings.map((job: any) => {
        const summaryCounts: SummaryPipelineCounts = {
          ...emptySummaryPipelineCounts(),
          ...(summaryColumnCounts[job.id] || {}),
        }
        summaryCounts.applied = totalApplicants[job.id] ?? summaryCounts.applied ?? 0

        // SLA bucket is pre-computed server-side using the memoised Indonesia
        // holiday lookup (same logic as dashboard). Use it directly — no browser
        // date-holidays calculation needed.
        const slaBucket: string = job.sla || '-'
        const slaDays = getPositionSlaWorkingDays({
          fptkReceiveDate: job.fptkReceiveDate ?? null,
          requestDate: job.requestDate ?? null,
          createdAt: job.createdAt ?? null,
          currentStatus: job.currentStatus ?? null,
          closedAt: job.closedAt ?? null,
          offerAcceptedAt: job.offerAcceptedAt ?? null,
        })

        return {
          id: job.id,
          priority: job.priority || job.urgentNormal || '—',
          division: job.department || job.division || '-',
          pt: (job.pt || '').trim() || '-',
          area: job.area || '-',
          location: job.areaDetail || job.location || '-',
          section: job.section || '-',
          position: job.positionTitle || job.position || job.title || '-',
          currentStatus:
            job.currentStatus != null && String(job.currentStatus).trim() !== ''
              ? String(job.currentStatus).trim()
              : '',
          statusFktk: job.statusFktk || '-',
          remark: job.remark || '-',
          sla: slaBucket,
          slaDays,
          hiringManager: (job.hiringManager || '').trim() || '—',
          summaryCounts,
          onboardingCandidates: onboardingCandidatesMap[job.id] ?? [],
          latestPipeline: getLatestPipelineProgress(
            (currentStatusesByFptkId[job.id] || []).map((status) => ({ backendStatus: status }))
          ),
          totalRequest: job.totalRequest ?? null,
          timeToOffer: timeToOfferMap[job.id] ?? null,
          offerAcceptedAt: job.offerAcceptedAt ?? null,
          referenceDate: job.fptkReceiveDate || job.requestDate || job.createdAt || null,
        }
      })

      setRows(result)

      const hmOpts =
        Array.isArray(payload?.hiringManagers) && payload.hiringManagers.length
          ? payload.hiringManagers
          : Array.from(
              new Set(result.map((r) => r.hiringManager).filter((hm) => hm && hm !== '—'))
            ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      setHiringManagers(hmOpts)
      setHiringManagerFilter((prev) => prev.filter((hm) => hmOpts.includes(hm)))

      const divOpts = Array.isArray(payload?.divisions) && payload.divisions.length
        ? payload.divisions
        : Array.from(new Set(result.map((r) => r.division))).filter(Boolean)
      const locOpts = Array.isArray(payload?.locations) && payload.locations.length
        ? payload.locations
        : Array.from(new Set(result.map((r) => r.location))).filter(Boolean)
      setDivisions(divOpts.filter(Boolean).sort())
      setLocations(locOpts.filter(Boolean).sort())

      // Build area → locations map so the Location dropdown can be filtered by Area
      const areaLocMap: Record<string, Set<string>> = {}
      allJobPostings.forEach((job: any) => {
        const a = job.area || '-'
        const loc = job.areaDetail || job.location || '-'
        if (!areaLocMap[a]) areaLocMap[a] = new Set()
        if (loc && loc !== '-') areaLocMap[a].add(loc)
      })
      setAreaToLocations(
        Object.fromEntries(
          Object.entries(areaLocMap).map(([a, s]) => [a, Array.from(s).sort()])
        )
      )
    } catch (err: any) {
      console.error('Error loading summary data:', err)
      setError(err?.message || 'An unexpected error occurred.')
      setRows([])
      setDivisions([])
      setLocations([])
      setHiringManagers([])
      setHiringManagerFilter([])
      setAreaToLocations({})
    } finally {
      if (!options?.silent) {
        setLoading(false)
      } else {
        setRefreshing(false)
      }
    }
  }

  const priorities = ['P0', 'P1', 'P2']

  // Page filters — shared by both tabs. The Overview charts read these rows
  // directly and apply the cross-filter themselves (per chart).
  const pageFilteredRows = useMemo(() => {
    const cutoff = requestDateCutoff(requestDateRange)
    return rows.filter((r) => {
      const priorityOk = priorityFilter.length === 0 || priorityFilter.includes(r.priority)
      const areaOk = areaFilter.length === 0 || areaFilter.includes(r.area)
      const locationOk = locationFilter.length === 0 || locationFilter.includes(r.location)
      const divisionOk = divisionFilter.length === 0 || divisionFilter.includes(r.division)
      const statusFktkOk = statusFktkFilter.length === 0 || statusFktkFilter.includes(r.statusFktk)
      const hiringManagerOk = hiringManagerMatches(r.hiringManager, hiringManagerFilter)
      const requestDateOk = matchesRequestDateRange(r.referenceDate, cutoff)
      return priorityOk && areaOk && locationOk && divisionOk && statusFktkOk && hiringManagerOk && requestDateOk
    })
  }, [rows, priorityFilter, areaFilter, locationFilter, divisionFilter, statusFktkFilter, hiringManagerFilter, requestDateRange])

  // Detail tab: page filters + the Overview cross-filter selection.
  const dropdownFilteredRows = useMemo(
    () => pageFilteredRows.filter((r) => matchesOverviewSelection(r, crossFilter)),
    [pageFilteredRows, crossFilter]
  )

  // Location options visible in the dropdown, narrowed to the selected area(s)
  const filteredLocationOptions = useMemo(() => {
    if (areaFilter.length === 0) return locations
    const allowed = new Set<string>()
    areaFilter.forEach((a) => {
      ;(areaToLocations[a] ?? []).forEach((loc) => allowed.add(loc))
    })
    return locations.filter((loc) => allowed.has(loc))
  }, [areaFilter, locations, areaToLocations])

  const SLA_BUCKET_MAP: Record<SlaCardKey, string> = {
    'sla-0-30': '0-30 Days',
    'sla-31-60': '31-60 Days',
    'sla-61-90': '61-90 Days',
    'sla-91': 'Above 91 Days',
  }

  const statusScopedRows = useMemo(() => {
    let filtered = dropdownFilteredRows
    if (activeStatusCard === 'open') {
      filtered = filtered.filter((r) => isFptkOpenByCurrentStatus(r.currentStatus))
    } else if (activeStatusCard === 'closed') {
      filtered = filtered.filter((r) => isFptkClosedByCurrentStatus(r.currentStatus))
    }
    return filtered
  }, [dropdownFilteredRows, activeStatusCard])

  const tableRows = useMemo(() => {
    if (!activeSlaCard) return statusScopedRows
    const bucket = SLA_BUCKET_MAP[activeSlaCard]
    return statusScopedRows.filter((r) => r.sla === bucket)
  }, [statusScopedRows, activeSlaCard])

  const openPositionCount = dropdownFilteredRows.filter((r) => isFptkOpenByCurrentStatus(r.currentStatus)).length
  const closedPositionCount = dropdownFilteredRows.filter((r) => isFptkClosedByCurrentStatus(r.currentStatus)).length

  const slaCounts = useMemo(() => {
    const counts: Record<string, number> = {
      '0-30 Days': 0, '31-60 Days': 0, '61-90 Days': 0, 'Above 91 Days': 0,
    }
    statusScopedRows.forEach((r) => {
      if (r.sla in counts) counts[r.sla] += 1
    })
    return counts
  }, [statusScopedRows])

  const sortedRows = useMemo(() => {
    return [...tableRows].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      const isFixedKey = FIXED_SORT_KEYS.includes(sortKey)

      if (!isFixedKey) {
        const av = a.summaryCounts[sortKey as SummaryPipelineColumnKey] ?? 0
        const bv = b.summaryCounts[sortKey as SummaryPipelineColumnKey] ?? 0
        return (av - bv) * dir
      }

      // Sort by exact working days rather than the bucket label string, so
      // "ascending" reads as least-urgent-first / most-urgent-first.
      if (sortKey === 'sla') {
        const av = a.slaDays ?? -1
        const bv = b.slaDays ?? -1
        return (av - bv) * dir
      }

      const av = (a[sortKey as keyof SummaryRow] ?? '').toString().toLowerCase()
      const bv = (b[sortKey as keyof SummaryRow] ?? '').toString().toLowerCase()
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
  }, [tableRows, sortKey, sortDir])

  const visiblePipelineColumns = useMemo(
    () => SUMMARY_PIPELINE_COLUMNS.filter((col) => !hiddenPipelineColumns.has(col.key)),
    [hiddenPipelineColumns]
  )

  const measureTableScrollWidth = useCallback(() => {
    const table = tableRef.current
    const container = tableScrollRef.current
    if (!table) return
    const width = table.scrollWidth
    setTableScrollWidth(width)
    if (container) {
      const needsBar = width > container.clientWidth + 1
      setShowHorizontalScrollBar(needsBar)
      const maxScroll = Math.max(0, width - container.clientWidth)
      setHorizontalScrollLeft((prev) => Math.min(prev, maxScroll))
    }
  }, [])

  useLayoutEffect(() => {
    measureTableScrollWidth()
    const table = tableRef.current
    const container = tableScrollRef.current
    if (!table || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => measureTableScrollWidth())
    ro.observe(table)
    if (container) ro.observe(container)
    return () => ro.disconnect()
  }, [
    measureTableScrollWidth,
    sortedRows.length,
    visiblePipelineColumns.length,
    hiddenPipelineColumns,
    loading,
    activeTab,
  ])

  useLayoutEffect(() => {
    const bar = hScrollBarRef.current
    if (!bar || hScrollSyncLock.current) return
    if (bar.scrollLeft !== horizontalScrollLeft) {
      hScrollSyncLock.current = true
      bar.scrollLeft = horizontalScrollLeft
      hScrollSyncLock.current = false
    }
  }, [horizontalScrollLeft])

  const handleBottomBarScroll = useCallback((scrollLeft: number) => {
    if (hScrollSyncLock.current) return
    setHorizontalScrollLeft(scrollLeft)
  }, [])

  const handleTableWheel = useCallback(
    (e: WheelEvent<HTMLDivElement>) => {
      if (!showHorizontalScrollBar) return
      const container = tableScrollRef.current
      if (!container) return
      const maxScroll = Math.max(0, tableScrollWidth - container.clientWidth)
      const delta =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0
      if (delta === 0) return
      e.preventDefault()
      setHorizontalScrollLeft((prev) => Math.min(maxScroll, Math.max(0, prev + delta)))
    },
    [showHorizontalScrollBar, tableScrollWidth]
  )

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      const isFixed = FIXED_SORT_KEYS.includes(key)
      setSortDir(isFixed ? 'asc' : 'desc')
    }
  }

  const toggleCardFilter = (key: SummaryCardKey) => {
    if (STATUS_CARD_KEYS.includes(key as StatusCardKey)) {
      setActiveStatusCard((prev) => (prev === key ? null : key as StatusCardKey))
    } else {
      setActiveSlaCard((prev) => (prev === key ? null : key as SlaCardKey))
    }
  }

  const sortIndicator = (key: string) => (
    <span className="ml-1 text-gray-300">
      {sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
    </span>
  )

  const StatCard = ({ cardKey, count }: { cardKey: SummaryCardKey; count: number }) => {
    const cfg = CARD_CONFIG[cardKey]
    const isActive = STATUS_CARD_KEYS.includes(cardKey as StatusCardKey)
      ? activeStatusCard === cardKey
      : activeSlaCard === cardKey

    return (
      <button
        type="button"
        onClick={() => toggleCardFilter(cardKey)}
        className={[
          'w-full text-left rounded-xl px-4 py-3 transition-all duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 border',
          isActive
            ? `${cfg.activeBg} border-2 ${cfg.border} ring-2 ${cfg.ring}`
            : 'bg-white border-gray-100 hover:border-gray-200 shadow-sm hover:shadow',
        ].join(' ')}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500 truncate">{cfg.label}</span>
          <span className={`h-2 w-2 rounded-full ${cfg.dot} shrink-0 ml-1`} />
        </div>
        <div className={`mt-1.5 text-2xl font-bold ${cfg.color}`}>{count}</div>
        <div className="mt-0.5">
          <span className="text-xs text-gray-400">{cfg.sublabel}</span>
        </div>
      </button>
    )
  }

  const totalColSpan = 4 + visiblePipelineColumns.length
  const siteGroups = useMemo(() => buildSiteGroups(sortedRows), [sortedRows])

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const expandAllGroups = () => {
    const keys = new Set<string>()
    siteGroups.forEach((site) => {
      keys.add(site.key)
      site.divisions.forEach((d) => keys.add(d.key))
    })
    setExpandedGroups(keys)
  }

  const collapseAllGroups = () => setExpandedGroups(new Set())

  const renderGroupRow = (group: GroupStats, level: 0 | 1, childCount: number) => {
    const expanded = expandedGroups.has(group.key)
    const Icon = expanded ? ChevronDownIcon : ChevronRightIcon
    const isSite = level === 0
    const rowBg = isSite ? 'bg-indigo-50 group-hover:bg-indigo-100' : 'bg-slate-50 group-hover:bg-slate-100'
    return (
      <tr
        key={group.key}
        className={`group cursor-pointer ${isSite ? 'border-t-2 border-indigo-100' : ''}`}
        onClick={() => toggleGroup(group.key)}
      >
        <td
          className={`${isSite ? 'px-3' : 'pl-7 pr-3'} py-1.5 max-w-[18rem] sticky left-0 z-10 border-r-2 border-indigo-100 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] ${rowBg} transition-colors`}
          title={group.name}
        >
          <button
            type="button"
            aria-expanded={expanded}
            className="flex items-center gap-1.5 min-w-0 w-full text-left"
          >
            <Icon className={`h-4 w-4 shrink-0 ${isSite ? 'text-indigo-600' : 'text-gray-500'}`} />
            <span
              className={`truncate ${isSite ? 'text-sm font-semibold text-indigo-900' : 'text-sm font-medium text-gray-800'}`}
            >
              {group.name}
            </span>
            <span className="shrink-0 rounded-full bg-white border border-gray-200 px-1.5 text-xs font-medium text-gray-600">
              {group.positionCount}
            </span>
          </button>
          {isSite && (
            <div className="pl-6 text-xs text-gray-500">
              {childCount} {childCount === 1 ? 'division' : 'divisions'}
            </div>
          )}
        </td>
        <td className={`px-3 py-1.5 ${rowBg} transition-colors`} />
        <td colSpan={2} className={`px-3 py-1.5 whitespace-nowrap text-xs text-gray-600 ${rowBg} transition-colors`}>
          <span>{group.openCount} open</span>
          {group.overdueCount > 0 && (
            <span
              className="ml-2 inline-flex items-center rounded-full bg-red-50 border border-red-200 px-2 py-0.5 font-medium text-red-700"
              title="Positions in the Above 91 Days SLA bucket"
            >
              {group.overdueCount} &gt; 90d
            </span>
          )}
        </td>
        {visiblePipelineColumns.map((col) => {
          const count = group.totals[col.key] ?? 0
          return (
            <td key={col.key} className={`px-3 py-1.5 whitespace-nowrap text-sm ${rowBg} transition-colors`}>
              {count === 0 ? (
                <span className="text-gray-300 text-xs">—</span>
              ) : (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${getSummaryPipelineColumnBadgeClass(col.key)}`}
                >
                  {count}
                </span>
              )}
            </td>
          )
        })}
      </tr>
    )
  }

  const renderPositionRow = (row: SummaryRow, grouped: boolean) => {
      const divisionSectionLine = formatDivisionSectionLine(row.division, row.section)
      const areaLocationLine = formatAreaLocationLine(row.area, row.location)
      const positionTitle = [row.position, divisionSectionLine, areaLocationLine]
        .filter(Boolean)
        .join('\n')

      return (
      <tr key={row.id} className="group hover:bg-gray-50 transition-colors">
        <td
          className={`${grouped ? 'pl-12 pr-3' : 'px-3'} py-1.5 text-sm text-gray-900 max-w-[18rem] sticky left-0 z-10 bg-white group-hover:bg-gray-50 border-r-2 border-indigo-100 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] transition-colors`}
          title={positionTitle}
        >
          {row.id ? (
            <div className="flex items-center gap-1 min-w-0">
              <button
                type="button"
                onClick={() =>
                  setCandidatePipelineTarget({ fptkId: row.id, positionLabel: row.position })
                }
                className="text-indigo-600 hover:text-indigo-800 hover:underline font-medium text-left truncate min-w-0"
                title="View candidate pipeline for this position"
              >
                {row.position}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  void positionEdit.open(row.id, 'Summary')
                }}
                className="shrink-0 text-gray-300 hover:text-indigo-600 transition-colors"
                title="Edit position"
                aria-label="Edit position"
              >
                <PencilSquareIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <span className="truncate block font-medium">{row.position}</span>
          )}
          {divisionSectionLine && (
            <div className="text-xs text-gray-500 truncate mt-0.5">{divisionSectionLine}</div>
          )}
          {areaLocationLine && (
            <div className="text-xs text-gray-400 truncate">{areaLocationLine}</div>
          )}
        </td>
        <td className="px-3 py-1 whitespace-nowrap text-sm text-gray-900">{row.priority}</td>
        <td className="px-3 py-1 whitespace-nowrap">
          <SlaHeroBadge sla={row.sla} slaDays={row.slaDays} />
        </td>
        <td className="px-3 py-1 max-w-[18rem]">
          <StatusCell
            currentStatus={row.currentStatus}
            statusFktk={row.statusFktk}
            remark={row.remark}
            latestPipeline={row.latestPipeline}
          />
        </td>
        {visiblePipelineColumns.map((col) => {
          const count = row.summaryCounts[col.key] ?? 0

          if (col.key === 'joinDates') {
            return (
              <td key={col.key} className="px-3 py-1 whitespace-nowrap text-sm">
                <JoinDatesCell
                  count={count}
                  summaryCounts={row.summaryCounts}
                  onboardingCandidates={row.onboardingCandidates}
                />
              </td>
            )
          }

          return (
            <td key={col.key} className="px-3 py-1 whitespace-nowrap text-sm">
              {count === 0 ? (
                <span className="text-gray-300 text-xs">—</span>
              ) : (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getSummaryPipelineColumnBadgeClass(col.key)}`}
                >
                  {count}
                </span>
              )}
            </td>
          )
        })}
      </tr>
      )
  }

  const hideEmptyColumns = () => {
    const empty = SUMMARY_PIPELINE_COLUMNS.filter((col) =>
      dropdownFilteredRows.every((r) => (r.summaryCounts[col.key] ?? 0) === 0)
    ).map((col) => col.key)
    setHiddenPipelineColumns(new Set(empty))
  }

  const switchTab = (tab: SummaryTab) => {
    setActiveTab(tab)
    // The docked scrollbar remounts with the table; start it at the left edge.
    setHorizontalScrollLeft(0)
  }

  if (loading) return <LoadingSkeleton />

  return (
    <Layout>
      <div
        className={[
          'space-y-6 transition-opacity duration-200',
          positionEdit.isOpen ? 'opacity-45 pointer-events-none' : '',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Summary by Position</h1>
            <p className="mt-1 text-sm text-gray-500">
              Vacancies and pipeline by Site (PT), Division and Hiring Manager.
            </p>
          </div>
          {refreshing && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Spinner size="sm" />
              <span>Refreshing…</span>
            </div>
          )}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
            <ExclamationCircleIcon className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Failed to load summary data</p>
              <p className="text-sm text-red-600 mt-0.5">{error}</p>
            </div>
            <button
              onClick={() => loadSummaryData()}
              className="shrink-0 rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-200 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white shadow rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MultiSelectDropdown
            label="Priority"
            options={priorities}
            value={priorityFilter}
            onChange={setPriorityFilter}
            placeholder="All priorities"
            searchPlaceholder="Search priority..."
          />
          {hiringManagers.length > 1 && (
            <MultiSelectDropdown
              label="Hiring Manager"
              options={hiringManagers}
              value={hiringManagerFilter}
              onChange={setHiringManagerFilter}
              placeholder="All hiring managers"
              searchPlaceholder="Search hiring manager..."
            />
          )}
          <MultiSelectDropdown
            label="Area"
            options={['HO', 'Site']}
            value={areaFilter}
            onChange={(val) => {
              setAreaFilter(val)
              // Clear location selections that no longer belong to the new area set
              if (val.length > 0) {
                const allowed = new Set(
                  val.flatMap((a) => areaToLocations[a] ?? [])
                )
                setLocationFilter((prev) => prev.filter((loc) => allowed.has(loc)))
              }
            }}
            placeholder="All areas"
            searchPlaceholder="HO or Site..."
          />
          <MultiSelectDropdown
            label="Location"
            options={filteredLocationOptions}
            value={locationFilter}
            onChange={setLocationFilter}
            placeholder={areaFilter.length > 0 ? `Locations in ${areaFilter.join(' / ')}` : 'All locations'}
            searchPlaceholder="Type location..."
          />
          <MultiSelectDropdown
            label="Division"
            options={divisions}
            value={divisionFilter}
            onChange={setDivisionFilter}
            placeholder="All divisions"
            searchPlaceholder="Type division..."
          />
          <MultiSelectDropdown
            label="Status FKTK"
            options={['Pending', 'Received']}
            value={statusFktkFilter}
            onChange={setStatusFktkFilter}
            placeholder="All statuses"
            searchPlaceholder="Pending or Received..."
          />
          <div>
            <label htmlFor="summary-request-date" className="block text-xs font-medium text-gray-500 mb-1">
              Request date
            </label>
            <select
              id="summary-request-date"
              value={requestDateRange}
              onChange={(e) => setRequestDateRange(e.target.value as RequestDateRange)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              title="FPTK receive date (falls back to request date)"
            >
              {REQUEST_DATE_RANGE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Cross-filter chip (set by clicking a row in an Overview chart) */}
        {crossFilter && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <span>Cross-filter:</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
              {OVERVIEW_DIMENSION_LABEL[crossFilter.dimension]}: {crossFilter.value}
              <button
                type="button"
                onClick={() => setCrossFilter(null)}
                className="ml-0.5 text-indigo-400 hover:text-indigo-700"
                aria-label="Clear cross-filter"
              >
                <XMarkIcon className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
        )}

        {/* Tabs */}
        <div role="tablist" aria-label="Summary views" className="flex gap-1 border-b border-gray-200">
          {(
            [
              { id: 'overview', label: 'Overview', count: null },
              { id: 'detail', label: 'Detail', count: sortedRows.length },
            ] as { id: SummaryTab; label: string; count: number | null }[]
          ).map((tab) => {
            const selected = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`summary-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`summary-panel-${tab.id}`}
                onClick={() => switchTab(tab.id)}
                className={[
                  '-mb-px inline-flex items-center gap-2 min-h-[44px] px-4 border-b-2 text-sm transition-colors',
                  selected
                    ? 'border-indigo-600 font-semibold text-gray-900'
                    : 'border-transparent font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300',
                ].join(' ')}
              >
                {tab.label}
                {tab.count != null && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      selected ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {activeTab === 'overview' && (
          <div role="tabpanel" id="summary-panel-overview" aria-labelledby="summary-tab-overview">
            {rows.length === 0 && !error ? (
              <div className="bg-white shadow rounded-lg px-4 py-10 text-center text-sm text-gray-500">
                No data available. Create some positions and applications to see the summary.
              </div>
            ) : (
              <SummaryOverviewTab
                rows={pageFilteredRows}
                metric="headcount"
                selection={crossFilter}
                onSelect={setCrossFilter}
                onViewDetail={() => switchTab('detail')}
              />
            )}
          </div>
        )}

        {activeTab === 'detail' && (
        <div role="tabpanel" id="summary-panel-detail" aria-labelledby="summary-tab-detail" className="space-y-6">
        {/* Position status (primary) then SLA buckets scoped to that selection */}
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Position status
            </p>
            <div className="grid grid-cols-2 gap-3 max-w-xl">
              <StatCard cardKey="open" count={openPositionCount} />
              <StatCard cardKey="closed" count={closedPositionCount} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {slaSectionLabel(activeStatusCard)}
              </p>
              <span className="text-xs text-gray-300">
                Indonesia working days · stacks with position status
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard cardKey="sla-0-30" count={slaCounts['0-30 Days']} />
              <StatCard cardKey="sla-31-60" count={slaCounts['31-60 Days']} />
              <StatCard cardKey="sla-61-90" count={slaCounts['61-90 Days']} />
              <StatCard cardKey="sla-91" count={slaCounts['Above 91 Days']} />
            </div>
          </div>
        </div>

        {/* Table card */}
        <div className="bg-white shadow rounded-lg flex flex-col">
          {/* Table toolbar */}
          <div className="px-4 pt-4 pb-3 sm:px-6 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100">
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-sm text-gray-500">
                Showing{' '}
                <span className="font-semibold text-gray-900">{sortedRows.length}</span>
                {' '}of{' '}
                <span className="font-semibold text-gray-900">{dropdownFilteredRows.length}</span>
                {' '}positions
              </p>
              {activeStatusCard && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                  {CARD_CONFIG[activeStatusCard].label}
                  <button
                    onClick={() => setActiveStatusCard(null)}
                    className="ml-0.5 text-blue-400 hover:text-blue-700"
                    aria-label="Clear position status filter"
                  >
                    <XMarkIcon className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
              {activeSlaCard && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                  {CARD_CONFIG[activeSlaCard].label}
                  <button
                    onClick={() => setActiveSlaCard(null)}
                    className="ml-0.5 text-indigo-400 hover:text-indigo-700"
                    aria-label="Clear SLA filter"
                  >
                    <XMarkIcon className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
              {activeStatusCard && activeSlaCard && (
                <button
                  onClick={() => { setActiveStatusCard(null); setActiveSlaCard(null) }}
                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Grouping controls */}
            <div className="ml-auto flex items-center gap-2">
              <div className="inline-flex rounded-md border border-gray-200 bg-white shadow-sm overflow-hidden text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setGroupBySite(true)}
                  className={`px-3 py-1.5 transition-colors ${groupBySite ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                  aria-pressed={groupBySite}
                >
                  By Site
                </button>
                <button
                  type="button"
                  onClick={() => setGroupBySite(false)}
                  className={`px-3 py-1.5 border-l border-gray-200 transition-colors ${!groupBySite ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                  aria-pressed={!groupBySite}
                >
                  Flat list
                </button>
              </div>
              {groupBySite && (
                <>
                  <button
                    type="button"
                    onClick={expandAllGroups}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    Expand all
                  </button>
                  <button
                    type="button"
                    onClick={collapseAllGroups}
                    className="text-xs text-gray-500 hover:text-gray-700 hover:underline"
                  >
                    Collapse all
                  </button>
                </>
              )}
            </div>

            {/* Column visibility toggle */}
            <div className="relative" ref={columnToggleRef}>
              <button
                type="button"
                onClick={() => setShowColumnToggle(prev => !prev)}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 shadow-sm transition-colors"
              >
                <AdjustmentsHorizontalIcon className="h-4 w-4" />
                Columns
                {hiddenPipelineColumns.size > 0 && (
                  <span className="ml-0.5 rounded-full bg-indigo-100 px-1.5 text-indigo-700">
                    {SUMMARY_PIPELINE_COLUMNS.length - hiddenPipelineColumns.size}/{SUMMARY_PIPELINE_COLUMNS.length}
                  </span>
                )}
              </button>

              {showColumnToggle && (
                <div className="absolute right-0 top-full z-20 mt-1 w-60 rounded-lg border border-gray-200 bg-white shadow-lg p-2 max-h-80 overflow-y-auto">
                  <div className="flex items-center justify-between px-2 py-1 mb-1">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Pipeline columns
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={hideEmptyColumns}
                        className="text-xs text-gray-500 hover:text-gray-700 hover:underline"
                      >
                        Hide empty
                      </button>
                      <button
                        onClick={() => setHiddenPipelineColumns(new Set())}
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        Show all
                      </button>
                    </div>
                  </div>
                  {SUMMARY_PIPELINE_COLUMNS.map((col) => (
                    <label
                      key={col.key}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={!hiddenPipelineColumns.has(col.key)}
                        onChange={() => {
                          setHiddenPipelineColumns((prev) => {
                            const next = new Set(prev)
                            if (next.has(col.key)) next.delete(col.key)
                            else next.add(col.key)
                            return next
                          })
                        }}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600"
                      />
                      <span className="truncate text-gray-700">{col.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/*
            Sticky <th> needs a vertical scroll container (max-h). Horizontal scroll uses the
            docked bar below so you can pan columns while still at the top of the list.
          */}
          <div className="flex flex-col min-h-[300px] max-h-[calc(100dvh-220px)]">
            <div
              ref={tableScrollRef}
              className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden"
              onWheel={handleTableWheel}
            >
              <div
                className="relative min-w-0"
                style={{
                  width: tableScrollWidth > 0 ? tableScrollWidth : '100%',
                  left: -horizontalScrollLeft,
                }}
              >
            <table ref={tableRef} className="min-w-full divide-y divide-gray-200">
              {/*
                sticky is intentionally on each <th> rather than <thead>.
                When overflow-x:auto creates a scroll container on the wrapper,
                browsers mis-paint a sticky <thead> behind tbody rows.
                Moving sticky to individual <th> cells avoids that bug entirely.
              */}
              <thead className="bg-gray-50">
                <tr>
                  {(
                    [
                      { key: 'position', label: 'Position', stickyLeft: true },
                      { key: 'priority', label: 'Priority' },
                      { key: 'sla', label: 'SLA' },
                      { key: 'currentStatus', label: 'Status' },
                    ] as { key: string; label: string; stickyLeft?: boolean }[]
                  ).map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      aria-sort={
                        sortKey === col.key
                          ? sortDir === 'asc' ? 'ascending' : 'descending'
                          : 'none'
                      }
                      className={[
                        'sticky top-0 cursor-pointer px-3 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider select-none whitespace-nowrap bg-gray-50 hover:bg-gray-100 transition-colors',
                        col.stickyLeft
                          ? 'left-0 z-30 border-r-2 border-indigo-100 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]'
                          : 'z-20',
                      ].join(' ')}
                    >
                      {col.label} {sortIndicator(col.key)}
                    </th>
                  ))}
                  {visiblePipelineColumns.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      aria-sort={
                        sortKey === col.key
                          ? sortDir === 'asc' ? 'ascending' : 'descending'
                          : 'none'
                      }
                      className="sticky top-0 z-20 cursor-pointer px-3 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider select-none bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <span className="whitespace-nowrap">{col.label} {sortIndicator(col.key)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {groupBySite
                  ? siteGroups.map((site) => (
                      <Fragment key={site.key}>
                        {renderGroupRow(site, 0, site.divisions.length)}
                        {expandedGroups.has(site.key) &&
                          site.divisions.map((div) => (
                            <Fragment key={div.key}>
                              {renderGroupRow(div, 1, div.rows.length)}
                              {expandedGroups.has(div.key) &&
                                div.rows.map((row) => renderPositionRow(row, true))}
                            </Fragment>
                          ))}
                      </Fragment>
                    ))
                  : sortedRows.map((row) => renderPositionRow(row, false))}

                {rows.length === 0 && !error && (
                  <tr>
                    <td
                      colSpan={totalColSpan}
                      className="px-4 py-10 text-center text-sm text-gray-500"
                    >
                      No data available. Create some positions and applications to see the summary.
                    </td>
                  </tr>
                )}
                {rows.length > 0 && sortedRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={totalColSpan}
                      className="px-4 py-10 text-center text-sm text-gray-500"
                    >
                      No rows match the selected filter.{' '}
                      {(activeStatusCard || activeSlaCard) && (
                        <button
                          onClick={() => { setActiveStatusCard(null); setActiveSlaCard(null) }}
                          className="text-indigo-600 hover:underline"
                        >
                          Clear card filters
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
              </div>
            </div>
            {showHorizontalScrollBar && (
              <div
                ref={hScrollBarRef}
                className="shrink-0 overflow-x-auto overflow-y-hidden border-t border-gray-200 bg-gray-50"
                onScroll={(e) => handleBottomBarScroll(e.currentTarget.scrollLeft)}
                aria-label="Scroll table horizontally"
              >
                <div style={{ width: tableScrollWidth, height: 14 }} />
              </div>
            )}
          </div>
        </div>
        </div>
        )}
      </div>

      <PositionEditOverlay
        isOpen={positionEdit.isOpen}
        jobPosting={positionEdit.jobPosting}
        loading={positionEdit.loading}
        onClose={positionEdit.close}
        onSave={positionEdit.handleSave}
        headerBackLabel={`Back to ${positionEdit.backLabel || 'Summary'}`}
        candidateStatusOnly={positionEdit.candidateStatusOnly}
        canManagePositionCandidates={positionEdit.canManagePositionCandidates}
      />

      <PositionCandidatePipelineModal
        isOpen={!!candidatePipelineTarget}
        onClose={() => setCandidatePipelineTarget(null)}
        fptkId={candidatePipelineTarget?.fptkId ?? null}
        fallbackPositionLabel={candidatePipelineTarget?.positionLabel}
      />
    </Layout>
  )
}

export default function SummaryByPositionPage() {
  return (
    <Suspense>
      <SummaryByPositionContent />
    </Suspense>
  )
}
