"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import Layout from '@/components/Layout/Layout'
import PositionEditOverlay from '@/components/PositionEditOverlay'
import { FPTKAPI } from '@/lib/api'
import MultiSelectDropdown from '@/components/MultiSelectDropdown'
import { usePositionEditOverlay } from '@/hooks/usePositionEditOverlay'
import { getSlaBucketIndonesiaWorkingDays } from '@/utils/indoBusinessDays'
import {
  displayFptkCurrentStatus,
  isFptkClosedByCurrentStatus,
  isFptkOpenByCurrentStatus,
} from '@/utils/fptkPositionStatus'
import {
  ExclamationCircleIcon,
  AdjustmentsHorizontalIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import Spinner from '@/components/Spinner'

interface StatusCounts {
  [status: string]: number
}

interface OnboardingCandidate {
  name: string
  joinDate: string | null
}

interface SummaryRow {
  id: string
  priority: string
  division: string
  area: string
  location: string
  section: string
  position: string
  currentStatus: string
  statusFktk: string
  remark: string
  sla: string
  counts: StatusCounts
  onboardingCandidates: OnboardingCandidate[]
}

const DEFAULT_STATUSES: string[] = [
  'Applied',
  'Under Review',
  'Shortlisted',
  'Interview Scheduled',
  'Interviewed',
  'Assessment',
  'Offering Creation',
  'Pending Feedback',
  'Offer Accepted',
  'MCU',
  'On Boarding',
  'Offer Rejected',
  'Rejected (Failed Interview / Assessment)',
  'Withdrawn',
  'Keep In View',
]

const FIXED_SORT_KEYS: string[] = [
  'priority', 'division', 'area', 'location', 'section', 'position',
  'currentStatus', 'statusFktk', 'remark', 'sla',
]

const TERMINAL_STATUSES = new Set([
  'Rejected (Failed Interview / Assessment)',
  'Offer Rejected',
  'Withdrawn',
])

const POSITIVE_STATUSES = new Set([
  'Offer Accepted',
  'On Boarding',
])

const KIV_STATUSES = new Set(['Keep In View'])

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

function getBadgeClass(status: string, count: number): string {
  if (count === 0) return 'bg-gray-100 text-gray-400'
  if (TERMINAL_STATUSES.has(status)) return 'bg-red-100 text-red-700'
  if (POSITIVE_STATUSES.has(status)) return 'bg-green-100 text-green-700'
  if (KIV_STATUSES.has(status)) return 'bg-yellow-100 text-yellow-700'
  return 'bg-indigo-100 text-indigo-800'
}

function SlaCell({ sla }: { sla: string }) {
  const config: Record<string, { dot: string; text: string }> = {
    '0-30 Days': { dot: 'bg-green-400', text: 'text-green-700' },
    '31-60 Days': { dot: 'bg-yellow-400', text: 'text-yellow-700' },
    '61-90 Days': { dot: 'bg-orange-400', text: 'text-orange-700' },
    'Above 91 Days': { dot: 'bg-red-500', text: 'text-red-700' },
  }
  const c = config[sla]
  if (!c) return <span className="text-gray-400">—</span>
  return (
    <span className={`inline-flex items-center gap-1.5 ${c.text} font-medium text-xs whitespace-nowrap`}>
      <span className={`h-2 w-2 rounded-full ${c.dot} shrink-0`} />
      {sla}
    </span>
  )
}

/**
 * Badge + portal tooltip for the "On Boarding" column.
 * Uses position:fixed rendered into document.body so the tooltip is never
 * clipped by the overflow-x-auto table wrapper.
 */
function OnBoardingCell({
  count,
  counts,
  onboardingCandidates,
}: {
  count: number
  counts: StatusCounts
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

  const totalApplied = counts['Applied'] ?? 0
  const totalShortlisted = counts['Shortlisted'] ?? 0
  const totalRejectedWithdrawn =
    (counts['Rejected (Failed Interview / Assessment)'] ?? 0) +
    (counts['Withdrawn'] ?? 0) +
    (counts['Offer Rejected'] ?? 0)

  const badge =
    count === 0 ? (
      <span className="text-gray-300 text-xs">—</span>
    ) : (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getBadgeClass('On Boarding', count)}`}>
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
                  <span className="text-gray-400 text-xs">Total Shortlisted</span>
                  <span className="text-xs font-bold text-indigo-300">{totalShortlisted}</span>
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

function SummaryByPositionContent() {
  const searchParams = useSearchParams()
  const _locationParam = searchParams.get('location')
  const _cardParam = searchParams.get('card')

  const [rows, setRows] = useState<SummaryRow[]>([])
  const [allStatuses, setAllStatuses] = useState<string[]>([])
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
    _cardParam && STATUS_CARD_KEYS.includes(_cardParam as StatusCardKey)
      ? (_cardParam as StatusCardKey)
      : null
  )
  const [activeSlaCard, setActiveSlaCard] = useState<SlaCardKey | null>(
    _cardParam && SLA_CARD_KEYS.includes(_cardParam as SlaCardKey)
      ? (_cardParam as SlaCardKey)
      : null
  )
  const [areaFilter, setAreaFilter] = useState<string[]>([])
  const [statusFktkFilter, setStatusFktkFilter] = useState<string[]>([])
  const [divisions, setDivisions] = useState<string[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const [areaToLocations, setAreaToLocations] = useState<Record<string, string[]>>({})
  const [hiddenStatuses, setHiddenStatuses] = useState<Set<string>>(new Set())
  const [showColumnToggle, setShowColumnToggle] = useState(false)

  const columnToggleRef = useRef<HTMLDivElement | null>(null)

  const positionEdit = usePositionEditOverlay(() => {
    void loadSummaryData({ silent: true })
  })

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

  const mapApplicationStatusToUi = (status: string): string => {
    const statusMap: Record<string, string> = {
      'SUBMITTED': 'Applied',
      'SCREENING': 'Shortlisted',
      'PSYCHOMETRIC_TEST': 'Under Review',
      'TECHNICAL_TEST': 'Assessment',
      'INTERVIEW_SCHEDULED': 'Interview Scheduled',
      'INTERVIEW_COMPLETED': 'Interviewed',
      'DOCUMENT_VERIFICATION': 'Under Review',
      'OFFER_PROPOSED': 'Offering Creation',
      'OFFER_APPROVED': 'Pending Feedback',
      'OFFER_SENT': 'Under Review',
      'OFFER_ACCEPTED': 'Offer Accepted',
      'OFFER_REJECTED': 'Offer Rejected',
      'MEDICAL_CHECKUP_SCHEDULED': 'Under Review',
      'MEDICAL_CHECKUP_COMPLETED': 'MCU',
      'CONTRACT_SENT': 'Offer Accepted',
      'CONTRACT_SIGNED': 'Offer Accepted',
      'ONBOARDING': 'On Boarding',
      'HIRED': 'Offer Accepted',
      'REJECTED': 'Rejected (Failed Interview / Assessment)',
      'WITHDRAWN': 'Withdrawn',
      'KEEP_IN_VIEW': 'Keep In View',
    }
    return statusMap[status] || 'Applied'
  }

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
      const applicationCounts: Record<string, Record<string, number>> = payload?.applicationCounts || {}
      // Total applicants per FPTK regardless of current status — keeps the
      // "Applied" column cumulative (never shrinks as candidates advance).
      const totalApplicants: Record<string, number> = payload?.totalApplicants || {}
      // Onboarding candidates per FPTK — shown in the On Boarding tooltip
      const onboardingCandidatesMap: Record<string, OnboardingCandidate[]> = payload?.onboardingCandidates || {}

      const collectedStatuses = new Set<string>(DEFAULT_STATUSES)

      const result: SummaryRow[] = allJobPostings.map((job: any) => {
        const counts: StatusCounts = {}
        DEFAULT_STATUSES.forEach(s => { counts[s] = 0 })

        const rawCounts = applicationCounts[job.id] || {}
        Object.entries(rawCounts).forEach(([backendStatus, c]) => {
          const uiStatus = mapApplicationStatusToUi((backendStatus || '').toString().toUpperCase())
          if (uiStatus) {
            counts[uiStatus] = (counts[uiStatus] || 0) + (Number(c) || 0)
            collectedStatuses.add(uiStatus)
          }
        })

        // Override "Applied" with the cumulative total so it stays fixed
        // as candidates move through later stages.
        counts['Applied'] = totalApplicants[job.id] ?? counts['Applied'] ?? 0

        const referenceDate = job.fptkReceiveDate || job.requestDate || job.createdAt
        const isClosed = isFptkClosedByCurrentStatus(job.currentStatus)
        const closeAnchorRaw = isClosed ? (job.closedAt || null) : null
        const closeAnchorDate = closeAnchorRaw ? new Date(closeAnchorRaw) : null
        const slaEndDate = closeAnchorDate && !isNaN(closeAnchorDate.getTime()) ? closeAnchorDate : new Date()
        let slaBucket = '-'
        if (referenceDate) {
          const dateObj = new Date(referenceDate)
          if (!isNaN(dateObj.getTime())) {
            slaBucket = getSlaBucketIndonesiaWorkingDays(dateObj, slaEndDate)
          }
        }

        return {
          id: job.id,
          priority: job.priority || job.urgentNormal || '—',
          division: job.department || job.division || '-',
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
          counts,
          onboardingCandidates: onboardingCandidatesMap[job.id] ?? [],
        }
      })

      setAllStatuses(Array.from(collectedStatuses))
      setRows(result)

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
      setAllStatuses([...DEFAULT_STATUSES])
      setDivisions([])
      setLocations([])
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

  const dropdownFilteredRows = useMemo(
    () =>
      rows.filter((r) => {
        const priorityOk = priorityFilter.length === 0 || priorityFilter.includes(r.priority)
        const areaOk = areaFilter.length === 0 || areaFilter.includes(r.area)
        const locationOk = locationFilter.length === 0 || locationFilter.includes(r.location)
        const divisionOk = divisionFilter.length === 0 || divisionFilter.includes(r.division)
        const statusFktkOk = statusFktkFilter.length === 0 || statusFktkFilter.includes(r.statusFktk)
        return priorityOk && areaOk && locationOk && divisionOk && statusFktkOk
      }),
    [rows, priorityFilter, areaFilter, locationFilter, divisionFilter, statusFktkFilter]
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

  const tableRows = useMemo(() => {
    let filtered = dropdownFilteredRows

    if (activeStatusCard === 'open') {
      filtered = filtered.filter((r) => isFptkOpenByCurrentStatus(r.currentStatus))
    } else if (activeStatusCard === 'closed') {
      filtered = filtered.filter((r) => isFptkClosedByCurrentStatus(r.currentStatus))
    }

    if (activeSlaCard) {
      const bucket = SLA_BUCKET_MAP[activeSlaCard]
      filtered = filtered.filter((r) => r.sla === bucket)
    }

    return filtered
  }, [dropdownFilteredRows, activeStatusCard, activeSlaCard])

  const openPositionCount = dropdownFilteredRows.filter((r) => isFptkOpenByCurrentStatus(r.currentStatus)).length
  const closedPositionCount = dropdownFilteredRows.filter((r) => isFptkClosedByCurrentStatus(r.currentStatus)).length

  const slaCounts = useMemo(() => {
    const counts: Record<string, number> = {
      '0-30 Days': 0, '31-60 Days': 0, '61-90 Days': 0, 'Above 91 Days': 0,
    }
    dropdownFilteredRows.forEach((r) => {
      if (r.sla in counts) counts[r.sla] += 1
    })
    return counts
  }, [dropdownFilteredRows])

  const sortedRows = useMemo(() => {
    return [...tableRows].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      const isFixedKey = FIXED_SORT_KEYS.includes(sortKey)

      if (!isFixedKey) {
        const av = a.counts[sortKey] ?? 0
        const bv = b.counts[sortKey] ?? 0
        return (av - bv) * dir
      }

      const av = (a[sortKey as keyof SummaryRow] ?? '').toString().toLowerCase()
      const bv = (b[sortKey as keyof SummaryRow] ?? '').toString().toLowerCase()
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
  }, [tableRows, sortKey, sortDir])

  const visibleStatuses = useMemo(
    () => allStatuses.filter(s => !hiddenStatuses.has(s)),
    [allStatuses, hiddenStatuses]
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

  const hideEmptyColumns = () => {
    const empty = allStatuses.filter(s =>
      dropdownFilteredRows.every(r => (r.counts[s] ?? 0) === 0)
    )
    setHiddenStatuses(new Set(empty))
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Summary by Position</h1>
            <p className="mt-1 text-sm text-gray-500">
              Pipeline status breakdown by Priority, Division, Section, and Position.
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
        <div className="bg-white shadow rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <MultiSelectDropdown
            label="Priority"
            options={priorities}
            value={priorityFilter}
            onChange={setPriorityFilter}
            placeholder="All priorities"
            searchPlaceholder="Search priority..."
          />
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
        </div>

        {/* --- All summary cards in one row --- */}
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
            <span>Position Status</span>
            <div className="h-px w-6 bg-gray-200" />
            <span>SLA Health</span>
            <span className="font-normal normal-case tracking-normal text-gray-300">
              · Indonesia working days · combine both groups to cross-filter
            </span>
          </div>
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard cardKey="open" count={openPositionCount} />
            <StatCard cardKey="closed" count={closedPositionCount} />
            <StatCard cardKey="sla-0-30" count={slaCounts['0-30 Days']} />
            <StatCard cardKey="sla-31-60" count={slaCounts['31-60 Days']} />
            <StatCard cardKey="sla-61-90" count={slaCounts['61-90 Days']} />
            <StatCard cardKey="sla-91" count={slaCounts['Above 91 Days']} />
          </div>
        </div>

        {/* Table card */}
        <div className="bg-white shadow rounded-lg">
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

            {/* Column visibility toggle */}
            <div className="relative" ref={columnToggleRef}>
              <button
                type="button"
                onClick={() => setShowColumnToggle(prev => !prev)}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 shadow-sm transition-colors"
              >
                <AdjustmentsHorizontalIcon className="h-4 w-4" />
                Columns
                {hiddenStatuses.size > 0 && (
                  <span className="ml-0.5 rounded-full bg-indigo-100 px-1.5 text-indigo-700">
                    {allStatuses.length - hiddenStatuses.size}/{allStatuses.length}
                  </span>
                )}
              </button>

              {showColumnToggle && (
                <div className="absolute right-0 top-full z-20 mt-1 w-60 rounded-lg border border-gray-200 bg-white shadow-lg p-2 max-h-80 overflow-y-auto">
                  <div className="flex items-center justify-between px-2 py-1 mb-1">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Application Stages
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={hideEmptyColumns}
                        className="text-xs text-gray-500 hover:text-gray-700 hover:underline"
                      >
                        Hide empty
                      </button>
                      <button
                        onClick={() => setHiddenStatuses(new Set())}
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        Show all
                      </button>
                    </div>
                  </div>
                  {allStatuses.map(status => (
                    <label
                      key={status}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={!hiddenStatuses.has(status)}
                        onChange={() => {
                          setHiddenStatuses(prev => {
                            const next = new Set(prev)
                            if (next.has(status)) next.delete(status)
                            else next.add(status)
                            return next
                          })
                        }}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600"
                      />
                      <span className="truncate text-gray-700">{status}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Table container — overflow-auto + max-h gives a true scroll context so sticky <th> cells work correctly. KPI cards/filters are outside this container and scroll naturally with the page. */}
          <div className="overflow-auto max-h-[calc(100dvh-220px)] min-h-[300px]">
            <table className="min-w-full divide-y divide-gray-200">
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
                      { key: 'priority', label: 'Priority' },
                      { key: 'area', label: 'Area' },
                      { key: 'location', label: 'Location' },
                      { key: 'division', label: 'Division' },
                      { key: 'section', label: 'Section' },
                      { key: 'position', label: 'Position', stickyLeft: true },
                      { key: 'currentStatus', label: 'Current Status' },
                      { key: 'statusFktk', label: 'Status FKTK' },
                      { key: 'remark', label: 'Remark' },
                      { key: 'sla', label: 'SLA' },
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
                  {visibleStatuses.map((status) => (
                    <th
                      key={status}
                      onClick={() => handleSort(status)}
                      aria-sort={
                        sortKey === status
                          ? sortDir === 'asc' ? 'ascending' : 'descending'
                          : 'none'
                      }
                      className="sticky top-0 z-20 cursor-pointer px-3 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider select-none bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <span className="whitespace-nowrap">{status} {sortIndicator(status)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedRows.map((row) => (
                  <tr key={row.id} className="group hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-1 whitespace-nowrap text-sm text-gray-900">{row.priority}</td>
                    <td className="px-3 py-1 whitespace-nowrap text-sm text-gray-900">{row.area}</td>
                    <td className="px-3 py-1 whitespace-nowrap text-sm text-gray-900">{row.location}</td>
                    <td className="px-3 py-1 text-sm text-gray-900 max-w-[9rem] truncate" title={row.division}>{row.division}</td>
                    <td className="px-3 py-1 text-sm text-gray-900 max-w-[12rem] truncate" title={row.section}>{row.section}</td>
                    <td className="px-3 py-1 text-sm text-gray-900 max-w-[16rem] sticky left-0 z-10 bg-white group-hover:bg-gray-50 border-r-2 border-indigo-100 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] transition-colors" title={row.position}>
                      {row.id ? (
                        <button
                          type="button"
                          onClick={() => void positionEdit.open(row.id, 'Summary')}
                          className="text-indigo-600 hover:text-indigo-800 hover:underline font-medium text-left w-full truncate block"
                        >
                          {row.position}
                        </button>
                      ) : (
                        <span className="truncate block">{row.position}</span>
                      )}
                    </td>
                    <td className="px-3 py-1 whitespace-nowrap text-sm text-gray-900">
                      {displayFptkCurrentStatus(row.currentStatus)}
                    </td>
                    <td className="px-3 py-1 whitespace-nowrap text-sm text-gray-900">{row.statusFktk}</td>
                    <td
                      className="px-3 py-1 text-sm text-gray-900 max-w-[10rem] truncate"
                      title={row.remark}
                    >
                      {row.remark}
                    </td>
                    <td className="px-3 py-1 whitespace-nowrap">
                      <SlaCell sla={row.sla} />
                    </td>
                    {visibleStatuses.map((status) => {
                      const count = row.counts[status] ?? 0

                      if (status === 'On Boarding') {
                        return (
                          <td key={status} className="px-3 py-1 whitespace-nowrap text-sm">
                            <OnBoardingCell
                              count={count}
                              counts={row.counts}
                              onboardingCandidates={row.onboardingCandidates}
                            />
                          </td>
                        )
                      }

                      return (
                        <td key={status} className="px-3 py-1 whitespace-nowrap text-sm">
                          {count === 0 ? (
                            <span className="text-gray-300 text-xs">—</span>
                          ) : (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getBadgeClass(status, count)}`}
                            >
                              {count}
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}

                {rows.length === 0 && !error && (
                  <tr>
                    <td
                      colSpan={10 + visibleStatuses.length}
                      className="px-4 py-10 text-center text-sm text-gray-500"
                    >
                      No data available. Create some positions and applications to see the summary.
                    </td>
                  </tr>
                )}
                {rows.length > 0 && sortedRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={10 + visibleStatuses.length}
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
      </div>

      <PositionEditOverlay
        isOpen={positionEdit.isOpen}
        jobPosting={positionEdit.jobPosting}
        loading={positionEdit.loading}
        onClose={positionEdit.close}
        onSave={positionEdit.handleSave}
        headerBackLabel={`Back to ${positionEdit.backLabel || 'Summary'}`}
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
