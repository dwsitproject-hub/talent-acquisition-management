'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Layout from '@/components/Layout/Layout'
import PositionEditOverlay from '@/components/PositionEditOverlay'
import ViewJobPostingModal from '@/components/ViewJobPostingModal'
import Spinner from '@/components/Spinner'
import {
  UsersIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  XCircleIcon,
  NoSymbolIcon,
  ArrowLeftOnRectangleIcon,
} from '@heroicons/react/24/outline'
import { DashboardStats, PositionStatusByLocation, OpenPositionProgress, SLALocation, FPTK } from '@/types'
import { DashboardAPI, CandidatesAPI, FPTKAPI, ApplicationsAPI } from '@/lib/api'
import { mapApiFptk } from './fptk/page'
import { businessDaysDiffIndonesia } from '@/utils/indoBusinessDays'
import {
  getDashboardPeriodBounds,
  periodOverPeriodChange,
  toMonthInputValue,
  toWeekInputValue,
  type DashboardTimeMode,
} from '@/utils/dashboardPeriod'
import { useModalEscape } from '@/hooks/useModalEscape'
import { usePositionEditOverlay } from '@/hooks/usePositionEditOverlay'

const PRIORITY_FILTERS = ['ALL', 'P0', 'P1', 'P2'] as const

const POSITION_STATUS_FILTERS = ['ALL', 'OPEN', 'CLOSED'] as const
type PositionStatusFilterType = typeof POSITION_STATUS_FILTERS[number]

const LOCATION_AREA_FILTERS = ['ALL', 'Site', 'HO'] as const
type LocationAreaFilterType = typeof LOCATION_AREA_FILTERS[number]

/** Closed position: Close or Cancel (any status NOT in this set is treated as Open) */
const isClosedPositionStatus = (status?: string) => {
  const s = (status || '').trim().toLowerCase()
  return s === 'close' || s === 'cancel' || s === 'cancelled'
}

const normalizeUiCurrentStatus = (value?: string) => (value || '').trim().toLowerCase()

/** Open Positions card: Open | Pending FKTK | Re-Open */
const isOpenCurrentStatusLabel = (value?: string) => {
  const s = normalizeUiCurrentStatus(value)
  if (!s) return true
  return (
    s === 'open' ||
    s === 'pending fktk' ||
    s === 're-open' ||
    s === 'reopen' ||
    s === 'internal movement'
  )
}

/** Closed Positions card: Close | Internal Movement */
const isClosedCurrentStatusLabel = (value?: string) => {
  const s = normalizeUiCurrentStatus(value)
  return s === 'close' || s === 'internal movement'
}

const isHoldCurrentStatusLabel = (value?: string) => normalizeUiCurrentStatus(value) === 'hold'

type DashboardListItem = {
  id?: string
  kind?: 'fptk' | 'candidate'
  title: string
  subtitle?: string
  meta?: string
}

const matchesQuery = (item: DashboardListItem, query: string) => {
  const q = (query || '').trim().toLowerCase()
  if (!q) return true
  const hay = `${item.title || ''} ${item.subtitle || ''} ${item.meta || ''}`.toLowerCase()
  return hay.includes(q)
}

const getPriorityValue = (position: any) => {
  const value = (position?.urgentNormal || position?.priority || '').toString().toUpperCase().trim()
  if (value === 'P0' || value === 'P1' || value === 'P2') return value
  return 'OTHER'
}

const filterPositionsByPriority = (positions: any[], filter: typeof PRIORITY_FILTERS[number]) => {
  if (filter === 'ALL') return positions
  return positions.filter((position) => getPriorityValue(position) === filter)
}

const parseDateValue = (value?: string | null) => {
  if (!value) return null
  const date = new Date(value)
  if (!isNaN(date.getTime())) {
    return date
  }
  // Attempt to parse YYYY-MM-DD style strings
  try {
    return new Date(`${value}T00:00:00`)
  } catch {
    return null
  }
}

const isWithinRange = (date: Date, start: Date, end: Date) =>
  date.getTime() >= start.getTime() && date.getTime() <= end.getTime()

const asUpperStatus = (value: any) => (value || '').toString().trim().toUpperCase()

const DASHBOARD_COMPARE_OFF_DELTA = {
  formattedChange: '—',
  sentiment: 'neutral' as const,
}


/** Sum FPTK currentStatus counts for statuses that match a predicate. */
function sumFptkStatuses(map: Record<string, number> | null | undefined, pred: (s: string) => boolean): number {
  if (!map) return 0
  return Object.entries(map).reduce((acc, [status, count]) => (pred(status) ? acc + (count || 0) : acc), 0)
}

/** Sum application status counts for a specific set of statuses. */
function sumAppStatuses(map: Record<string, number> | null | undefined, statuses: string[]): number {
  if (!map) return 0
  const set = new Set(statuses)
  return Object.entries(map).reduce((acc, [status, count]) => (set.has(status) ? acc + (count || 0) : acc), 0)
}

export default function Dashboard() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalCandidates: 0,
    activeApplications: 0,
    openPositions: 0,
    closedPositions: 0,
    holdPositions: 0,
    interviewsThisWeek: 0,
    hiredThisMonth: 0,
    recentActivity: [] as any[],
    positionStatusByLocation: [],
    openPositionProgress: [],
    slaByLocation: []
  })
  const [detailModal, setDetailModal] = useState<{ title: string, items: any[] } | null>(null)
  const [detailQuery, setDetailQuery] = useState('')
  const [slaPositionView, setSlaPositionView] = useState<{ isOpen: boolean; jobPosting: FPTK | null; loading: boolean }>({ isOpen: false, jobPosting: null, loading: false })
  const [baseStats, setBaseStats] = useState<Partial<DashboardStats> | null>(null)
  const [priorityFilter, setPriorityFilter] = useState<typeof PRIORITY_FILTERS[number]>('ALL')
  const [positionStatusFilter, setPositionStatusFilter] = useState<PositionStatusFilterType>('ALL')
  const [locationAreaFilter, setLocationAreaFilter] = useState<LocationAreaFilterType>('ALL')
  const [isDashboardLoading, setIsDashboardLoading] = useState(false)
  const [openPositionsModalOpen, setOpenPositionsModalOpen] = useState(false)
  const [openPositionsQuery, setOpenPositionsQuery] = useState('')
  const [openPositionsLoading, setOpenPositionsLoading] = useState(false)
  const [openPositionsError, setOpenPositionsError] = useState<string>('')
  const [openPositionsList, setOpenPositionsList] = useState<any[]>([])
  const openPositionsLoadedOnceRef = useRef(false)

  const TOTAL_CANDIDATES_MODAL_PAGE_SIZE = 100
  const DETAIL_MODAL_PAGE_SIZE = 100
  const OPEN_POSITIONS_MODAL_PAGE_SIZE = 100
  const [totalCandidatesModal, setTotalCandidatesModal] = useState<{
    page: number
    totalPages: number
    total: number
    items: DashboardListItem[]
    loading: boolean
  } | null>(null)
  const [totalCandidatesQuery, setTotalCandidatesQuery] = useState('')
  const [detailModalPage, setDetailModalPage] = useState(1)
  const [openPositionsPage, setOpenPositionsPage] = useState(1)

  const [timeMode, setTimeMode] = useState<DashboardTimeMode>('month')
  /** When true, stat cards use selected week/month/custom vs previous period; when false, Daily Operations (no date window). */
  const [compareToPrevious, setCompareToPrevious] = useState(false)
  const [weekValue, setWeekValue] = useState(() => toWeekInputValue())
  const [monthValue, setMonthValue] = useState(() => toMonthInputValue())
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = d.getMonth()
    return `${y}-${String(m + 1).padStart(2, '0')}-01`
  })
  const [customEnd, setCustomEnd] = useState(() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = d.getMonth()
    const last = new Date(y, m + 1, 0)
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
  })

  const closeDetailModal = useCallback(() => {
    setDetailModal(null)
    setDetailQuery('')
    setDetailModalPage(1)
  }, [])
  const closeTotalCandidatesModal = useCallback(() => {
    setTotalCandidatesModal(null)
    setTotalCandidatesQuery('')
  }, [])

  useModalEscape(openPositionsModalOpen, () => setOpenPositionsModalOpen(false))
  useModalEscape(!!totalCandidatesModal, closeTotalCandidatesModal)
  useModalEscape(!!detailModal, closeDetailModal)

  const periodBounds = useMemo(
    () => getDashboardPeriodBounds(timeMode, { weekValue, monthValue, customStart, customEnd }),
    [timeMode, weekValue, monthValue, customStart, customEnd]
  )

  const activePeriod = useMemo(() => {
    if (periodBounds) return periodBounds
    return getDashboardPeriodBounds('month', {
      weekValue: toWeekInputValue(),
      monthValue: toMonthInputValue(),
      customStart: '',
      customEnd: '',
    }) as NonNullable<ReturnType<typeof getDashboardPeriodBounds>>
  }, [periodBounds])

  // ── Backend-provided count maps ─────────────────────────────────────────────
  const fptkCounts = useMemo(
    () => baseStats?.fptkCountsByCurrentStatus ?? {},
    [baseStats?.fptkCountsByCurrentStatus]
  )
  const appCounts = useMemo(
    () => baseStats?.applicationCountsByStatus ?? {},
    [baseStats?.applicationCountsByStatus]
  )
  const fptkPeriod = useMemo(
    () => baseStats?.fptkPeriodCounts ?? { current: null, previous: null },
    [baseStats?.fptkPeriodCounts]
  )
  const appPeriod = useMemo(
    () => baseStats?.appPeriodCounts ?? { current: null, previous: null },
    [baseStats?.appPeriodCounts]
  )

  // ── Headline counts derived from backend maps (O(n) over unique statuses) ──
  // When compareToPrevious is on and period data is available, show period-filtered counts
  // so the headline numbers match the selected time window. Otherwise show all-time totals.
  const totalCandidateHeadline = useMemo(
    () => baseStats?.totalCandidates ?? 0,
    [baseStats?.totalCandidates]
  )
  const openPositionsCount = useMemo(() => {
    const map = compareToPrevious && fptkPeriod.current ? fptkPeriod.current : fptkCounts
    return sumFptkStatuses(map, isOpenCurrentStatusLabel)
  }, [compareToPrevious, fptkPeriod, fptkCounts])
  const closedPositionsCount = useMemo(() => {
    const map = compareToPrevious && fptkPeriod.current ? fptkPeriod.current : fptkCounts
    return sumFptkStatuses(map, isClosedCurrentStatusLabel)
  }, [compareToPrevious, fptkPeriod, fptkCounts])
  const holdPositionsCount = useMemo(() => {
    const map = compareToPrevious && fptkPeriod.current ? fptkPeriod.current : fptkCounts
    const key = Object.keys(map).find((k) => k.toLowerCase() === 'hold')
    return key ? (map[key] ?? 0) : 0
  }, [compareToPrevious, fptkPeriod, fptkCounts])
  // "Hired" = FPTKs with currentStatus exactly 'close'
  const hiredCount = useMemo(() => {
    const map = compareToPrevious && fptkPeriod.current ? fptkPeriod.current : fptkCounts
    const key = Object.keys(map).find((k) => k.toLowerCase() === 'close')
    return key ? (map[key] ?? 0) : 0
  }, [compareToPrevious, fptkPeriod, fptkCounts])

  const interviewCount = useMemo(() => {
    const map = compareToPrevious && appPeriod.current ? appPeriod.current : appCounts
    return sumAppStatuses(map, ['INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'TECHNICAL_TEST'])
  }, [compareToPrevious, appPeriod, appCounts])
  const offeringStageCount = useMemo(() => {
    const map = compareToPrevious && appPeriod.current ? appPeriod.current : appCounts
    return sumAppStatuses(map, ['OFFER_PROPOSED', 'OFFER_APPROVED', 'OFFER_ACCEPTED'])
  }, [compareToPrevious, appPeriod, appCounts])
  const mcuCount = useMemo(() => {
    const map = compareToPrevious && appPeriod.current ? appPeriod.current : appCounts
    return sumAppStatuses(map, ['MEDICAL_CHECKUP_COMPLETED'])
  }, [compareToPrevious, appPeriod, appCounts])
  const offerRejectedCount = useMemo(() => {
    const map = compareToPrevious && appPeriod.current ? appPeriod.current : appCounts
    return sumAppStatuses(map, ['OFFER_REJECTED'])
  }, [compareToPrevious, appPeriod, appCounts])
  const rejectedCount = useMemo(() => {
    const map = compareToPrevious && appPeriod.current ? appPeriod.current : appCounts
    return sumAppStatuses(map, ['REJECTED'])
  }, [compareToPrevious, appPeriod, appCounts])
  const withdrawnCount = useMemo(() => {
    const map = compareToPrevious && appPeriod.current ? appPeriod.current : appCounts
    return sumAppStatuses(map, ['WITHDRAWN'])
  }, [compareToPrevious, appPeriod, appCounts])

  // ── mapApplicationToDetailItem (still used for lazy-load modals) ────────────
  const mapApplicationToDetailItem = (application: any): DashboardListItem => {
    const candidateName =
      `${application?.candidate?.user?.firstName || ''} ${application?.candidate?.user?.lastName || ''}`.trim() ||
      application?.candidate?.fullName ||
      'Unknown Candidate'
    const positionTitle =
      application?.fptk?.positionTitle || application?.fptk?.position || 'Unknown Position'
    const department = application?.fptk?.department || application?.candidate?.user?.division || 'N/A'
    return {
      id: application?.fptkId || application?.id,
      kind: application?.fptkId ? ('fptk' as const) : undefined,
      title: candidateName,
      subtitle: `${positionTitle} • ${department}`,
      meta: asUpperStatus(application?.status).replace(/_/g, ' '),
    }
  }

  // ── WoW deltas — now from backend period-filtered groupBy counts ────────────
  const wowOpenPositions = useMemo(() => {
    if (!compareToPrevious || !fptkPeriod.current || !fptkPeriod.previous) return DASHBOARD_COMPARE_OFF_DELTA
    return periodOverPeriodChange(
      sumFptkStatuses(fptkPeriod.current, isOpenCurrentStatusLabel),
      sumFptkStatuses(fptkPeriod.previous, isOpenCurrentStatusLabel)
    )
  }, [compareToPrevious, fptkPeriod])

  const wowTotalCandidateStatus = useMemo(() => {
    if (!compareToPrevious || !appPeriod.current || !appPeriod.previous) return DASHBOARD_COMPARE_OFF_DELTA
    return periodOverPeriodChange(
      sumAppStatuses(appPeriod.current, ['SUBMITTED', 'SCREENING']),
      sumAppStatuses(appPeriod.previous, ['SUBMITTED', 'SCREENING'])
    )
  }, [compareToPrevious, appPeriod])

  const wowInterviewStatus = useMemo(() => {
    if (!compareToPrevious || !appPeriod.current || !appPeriod.previous) return DASHBOARD_COMPARE_OFF_DELTA
    return periodOverPeriodChange(
      sumAppStatuses(appPeriod.current, ['INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'TECHNICAL_TEST']),
      sumAppStatuses(appPeriod.previous, ['INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'TECHNICAL_TEST'])
    )
  }, [compareToPrevious, appPeriod])

  const wowOfferingStatus = useMemo(() => {
    if (!compareToPrevious || !appPeriod.current || !appPeriod.previous) return DASHBOARD_COMPARE_OFF_DELTA
    return periodOverPeriodChange(
      sumAppStatuses(appPeriod.current, ['OFFER_PROPOSED', 'OFFER_APPROVED', 'OFFER_ACCEPTED']),
      sumAppStatuses(appPeriod.previous, ['OFFER_PROPOSED', 'OFFER_APPROVED', 'OFFER_ACCEPTED'])
    )
  }, [compareToPrevious, appPeriod])

  const wowMcuStatus = useMemo(() => {
    if (!compareToPrevious || !appPeriod.current || !appPeriod.previous) return DASHBOARD_COMPARE_OFF_DELTA
    return periodOverPeriodChange(
      sumAppStatuses(appPeriod.current, ['MEDICAL_CHECKUP_COMPLETED']),
      sumAppStatuses(appPeriod.previous, ['MEDICAL_CHECKUP_COMPLETED'])
    )
  }, [compareToPrevious, appPeriod])

  const wowOfferRejected = useMemo(() => {
    if (!compareToPrevious || !appPeriod.current || !appPeriod.previous) return DASHBOARD_COMPARE_OFF_DELTA
    return periodOverPeriodChange(
      sumAppStatuses(appPeriod.current, ['OFFER_REJECTED']),
      sumAppStatuses(appPeriod.previous, ['OFFER_REJECTED'])
    )
  }, [compareToPrevious, appPeriod])

  const wowRejected = useMemo(() => {
    if (!compareToPrevious || !appPeriod.current || !appPeriod.previous) return DASHBOARD_COMPARE_OFF_DELTA
    return periodOverPeriodChange(
      sumAppStatuses(appPeriod.current, ['REJECTED']),
      sumAppStatuses(appPeriod.previous, ['REJECTED'])
    )
  }, [compareToPrevious, appPeriod])

  const wowWithdrawn = useMemo(() => {
    if (!compareToPrevious || !appPeriod.current || !appPeriod.previous) return DASHBOARD_COMPARE_OFF_DELTA
    return periodOverPeriodChange(
      sumAppStatuses(appPeriod.current, ['WITHDRAWN']),
      sumAppStatuses(appPeriod.previous, ['WITHDRAWN'])
    )
  }, [compareToPrevious, appPeriod])

  const wowHiredRolling = useMemo(() => {
    if (!compareToPrevious || !fptkPeriod.current || !fptkPeriod.previous) return DASHBOARD_COMPARE_OFF_DELTA
    const sumClosed = (m: Record<string, number>) => {
      const key = Object.keys(m).find((k) => k.toLowerCase() === 'close')
      return key ? (m[key] ?? 0) : 0
    }
    return periodOverPeriodChange(sumClosed(fptkPeriod.current), sumClosed(fptkPeriod.previous))
  }, [compareToPrevious, fptkPeriod])

  const customRangeInvalid = timeMode === 'custom' && !periodBounds

  const filteredDetailItems = useMemo(() => {
    return detailModal ? detailModal.items.filter((it: DashboardListItem) => matchesQuery(it, detailQuery)) : []
  }, [detailModal, detailQuery])

  const detailModalMeta = useMemo(() => {
    const total = filteredDetailItems.length
    const totalPages = Math.max(1, Math.ceil(total / DETAIL_MODAL_PAGE_SIZE))
    const safePage = Math.min(detailModalPage, totalPages)
    const start = (safePage - 1) * DETAIL_MODAL_PAGE_SIZE
    const end = start + DETAIL_MODAL_PAGE_SIZE
    return {
      total,
      totalPages,
      safePage,
      pagedItems: filteredDetailItems.slice(start, end),
    }
  }, [filteredDetailItems, detailModalPage, DETAIL_MODAL_PAGE_SIZE])

  const openPositionsMeta = useMemo(() => {
    const total = openPositionsList.length
    const totalPages = Math.max(1, Math.ceil(total / OPEN_POSITIONS_MODAL_PAGE_SIZE))
    const safePage = Math.min(openPositionsPage, totalPages)
    const start = (safePage - 1) * OPEN_POSITIONS_MODAL_PAGE_SIZE
    const end = start + OPEN_POSITIONS_MODAL_PAGE_SIZE
    return {
      total,
      totalPages,
      safePage,
      pagedItems: openPositionsList.slice(start, end),
    }
  }, [openPositionsList, openPositionsPage, OPEN_POSITIONS_MODAL_PAGE_SIZE])

  useEffect(() => {
    setDetailModalPage(1)
  }, [detailQuery, detailModal?.title])

  useEffect(() => {
    setOpenPositionsPage(1)
  }, [openPositionsList, openPositionsModalOpen])

  const combinedLocations = useMemo(() => {
    const locationsSet = new Set<string>()

    dashboardStats.positionStatusByLocation.forEach((item) => {
      if (item.location) locationsSet.add(item.location)
    })

    dashboardStats.openPositionProgress.forEach((item: any) => {
      if (item.areaDetail) locationsSet.add(item.areaDetail)
    })

    dashboardStats.slaByLocation.forEach((item: any) => {
      if (item.areaDetail) locationsSet.add(item.areaDetail)
    })

    return Array.from(locationsSet).sort()
  }, [dashboardStats.positionStatusByLocation, dashboardStats.openPositionProgress, dashboardStats.slaByLocation])

  const stats = useMemo(
    () => [
      {
        name: 'Total Candidates',
        value: totalCandidateHeadline.toString(),
        icon: UsersIcon,
        change: wowTotalCandidateStatus.formattedChange,
        changeType: wowTotalCandidateStatus.sentiment,
      },
      {
        name: 'Open Positions',
        value: openPositionsCount.toString(),
        icon: BriefcaseIcon,
        change: wowOpenPositions.formattedChange,
        changeType: wowOpenPositions.sentiment,
      },
      {
        name: 'Interview',
        value: interviewCount.toString(),
        icon: BriefcaseIcon,
        change: wowInterviewStatus.formattedChange,
        changeType: wowInterviewStatus.sentiment,
      },
      {
        name: 'Offering Stage',
        value: offeringStageCount.toString(),
        icon: BriefcaseIcon,
        change: wowOfferingStatus.formattedChange,
        changeType: wowOfferingStatus.sentiment,
      },
      {
        name: 'MCU',
        value: mcuCount.toString(),
        icon: CalendarDaysIcon,
        change: wowMcuStatus.formattedChange,
        changeType: wowMcuStatus.sentiment,
      },
      {
        name: 'Hired',
        value: hiredCount.toString(),
        icon: DocumentTextIcon,
        change: wowHiredRolling.formattedChange,
        changeType: wowHiredRolling.sentiment,
      },
      {
        name: 'Offer Rejected',
        value: offerRejectedCount.toString(),
        icon: XCircleIcon,
        change: wowOfferRejected.formattedChange,
        changeType: wowOfferRejected.sentiment,
      },
      {
        name: 'Rejected',
        value: rejectedCount.toString(),
        icon: NoSymbolIcon,
        change: wowRejected.formattedChange,
        changeType: wowRejected.sentiment,
      },
      {
        name: 'Withdrawn',
        value: withdrawnCount.toString(),
        icon: ArrowLeftOnRectangleIcon,
        change: wowWithdrawn.formattedChange,
        changeType: wowWithdrawn.sentiment,
      },
    ],
    [
      openPositionsCount,
      wowOpenPositions,
      totalCandidateHeadline,
      wowTotalCandidateStatus,
      interviewCount,
      wowInterviewStatus,
      offeringStageCount,
      wowOfferingStatus,
      mcuCount,
      wowMcuStatus,
      hiredCount,
      wowHiredRolling,
      offerRejectedCount,
      wowOfferRejected,
      rejectedCount,
      wowRejected,
      withdrawnCount,
      wowWithdrawn,
      compareToPrevious,
    ]
  )

  // Build params for the dashboard API — re-computed whenever filters or period change
  const currentParams = useMemo(() => ({
    ...(priorityFilter !== 'ALL' ? { priority: priorityFilter } : {}),
    ...(positionStatusFilter !== 'ALL' ? { positionStatus: positionStatusFilter } : {}),
    ...(locationAreaFilter !== 'ALL' ? { area: locationAreaFilter } : {}),
    ...(compareToPrevious && periodBounds
      ? {
          periodStart: periodBounds.current.start.toISOString(),
          periodEnd: periodBounds.current.end.toISOString(),
          previousStart: periodBounds.previous.start.toISOString(),
          previousEnd: periodBounds.previous.end.toISOString(),
        }
      : {}),
  }), [priorityFilter, positionStatusFilter, locationAreaFilter, compareToPrevious, periodBounds])

  const didInitialLoad = useRef(false)

  // Initial load on auth
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    } else if (isAuthenticated) {
      didInitialLoad.current = true
      loadDashboardData(currentParams)
    }
  }, [isAuthenticated, isLoading, router])

  // Re-fetch whenever filters or period change (skip the very first render)
  useEffect(() => {
    if (!didInitialLoad.current || !isAuthenticated) return
    loadDashboardData(currentParams)
  }, [currentParams])

  // Sync dashboardStats from backend-provided data
  useEffect(() => {
    if (!baseStats) return
    setDashboardStats({
      totalCandidates: totalCandidateHeadline,
      activeApplications: baseStats.activeApplications ?? 0,
      openPositions: openPositionsCount,
      closedPositions: closedPositionsCount,
      holdPositions: holdPositionsCount,
      interviewsThisWeek: interviewCount,
      hiredThisMonth: hiredCount,
      recentActivity: baseStats.recentActivity ?? [],
      positionStatusByLocation: baseStats.positionStatusByLocation ?? [],
      openPositionProgress: baseStats.openPositionProgress ?? [],
      slaByLocation: baseStats.slaByLocation ?? [],
    })
  }, [
    baseStats,
    totalCandidateHeadline,
    openPositionsCount,
    closedPositionsCount,
    holdPositionsCount,
    interviewCount,
    hiredCount,
  ])

  const fetchOpenPositions = async (query: string) => {
    if (!isAuthenticated) return
    setOpenPositionsLoading(true)
    setOpenPositionsError('')
    try {
      const limit = 100
      const maxPages = 20
      let page = 1
      let hasMore = true
      let positions: any[] = []

      while (hasMore && page <= maxPages) {
        const response = await FPTKAPI.getAll({ search: query || '' }, { page, limit })
        const data = Array.isArray(response?.data) ? response.data : []
        const mapped = data.map((fptk: any) => mapApiFptk(fptk))
        positions = positions.concat(mapped)

        const totalPages = response?.pagination?.totalPages
        if (totalPages) {
          hasMore = page < totalPages
        } else {
          hasMore = data.length === limit
        }
        page += 1
      }

      const openOnly = positions.filter((p: any) => isOpenCurrentStatusLabel(p?.currentStatus || p?.status))
      setOpenPositionsList(openOnly.map((p: any) => ({ ...p, kind: 'fptk' as const })))
      openPositionsLoadedOnceRef.current = true
    } catch (e: any) {
      console.error('fetchOpenPositions failed:', e)
      setOpenPositionsError(e?.response?.data?.message || e?.message || 'Failed to load open positions')
      setOpenPositionsList([])
    } finally {
      setOpenPositionsLoading(false)
    }
  }

  /**
   * Load all dashboard stats in a single API call.
   * Replaces the old pattern of fetching all FPTKs (up to 3,000 records) and
   * all applications (up to 5,000 records) via sequential paginated loops.
   */
  const loadDashboardData = async (params: Parameters<typeof DashboardAPI.getStats>[0] = {}) => {
    if (!isAuthenticated) return
    setIsDashboardLoading(true)
    try {
      const stats = await DashboardAPI.getStats(params)
      setBaseStats({
        totalCandidates: stats.totalCandidates ?? 0,
        activeApplications: stats.activeApplications ?? 0,
        recentActivity: stats.recentActivity ?? [],
        openPositions: stats.openPositions ?? 0,
        closedPositions: stats.closedPositions ?? 0,
        holdPositions: stats.holdPositions ?? 0,
        interviewsThisWeek: stats.interviewsThisWeek ?? 0,
        hiredThisMonth: stats.hiredThisMonth ?? 0,
        positionStatusByLocation: stats.positionStatusByLocation ?? [],
        openPositionProgress: stats.openPositionProgress ?? [],
        slaByLocation: stats.slaByLocation ?? [],
        fptkCountsByCurrentStatus: stats.fptkCountsByCurrentStatus ?? {},
        applicationCountsByStatus: stats.applicationCountsByStatus ?? {},
        fptkPeriodCounts: stats.fptkPeriodCounts ?? { current: null, previous: null },
        appPeriodCounts: stats.appPeriodCounts ?? { current: null, previous: null },
      })
    } catch (error: any) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setIsDashboardLoading(false)
    }
  }

  /**
   * Lazy-load list items for a stat card's detail modal.
   * Called only when the user clicks on a card — no pre-loading.
   */
  const loadModalItems = async (cardName: string): Promise<DashboardListItem[]> => {
    const appStatusMap: Record<string, string> = {
      Interview: 'INTERVIEW_SCHEDULED,INTERVIEW_COMPLETED,TECHNICAL_TEST',
      'Offering Stage': 'OFFER_PROPOSED,OFFER_APPROVED,OFFER_ACCEPTED',
      MCU: 'MEDICAL_CHECKUP_COMPLETED',
      'Offer Rejected': 'OFFER_REJECTED',
      Rejected: 'REJECTED',
      Withdrawn: 'WITHDRAWN',
    }

    const appStatus = appStatusMap[cardName]
    if (appStatus) {
      const res = await ApplicationsAPI.getAll({ status: appStatus }, { limit: 500 })
      const data = Array.isArray(res?.data) ? res.data : []
      return data.map(mapApplicationToDetailItem)
    }

    if (cardName === 'Hired') {
      const res = await FPTKAPI.getAll({ currentStatus: 'Close' }, { limit: 500 })
      const data = Array.isArray(res?.data) ? res.data : []
      return data.map((p: any) => ({
        id: p?.id,
        kind: 'fptk' as const,
        title: p?.positionTitle || p?.position || 'Unknown Position',
        subtitle: `${p?.department || 'N/A'} • ${p?.areaDetail || p?.area || p?.location || 'N/A'}`,
        meta: p?.currentStatus || 'Close',
      }))
    }

    return []
  }

  const mapApiCandidatesToDashboardItems = (rows: any[]): DashboardListItem[] =>
    (rows || []).map((c: any) => ({
      id: c.id,
      kind: 'candidate' as const,
      title: `${c.user?.firstName || ''} ${c.user?.lastName || ''}`.trim() || 'Unknown',
      subtitle: c.user?.email || 'No email',
      meta: c._count?.applications ? `${c._count.applications} application(s)` : 'No applications',
    }))

  const loadTotalCandidatesModalPage = async (page: number) => {
    setTotalCandidatesModal((prev) =>
      prev
        ? { ...prev, loading: true }
        : { page: 1, totalPages: 1, total: 0, items: [], loading: true }
    )
    try {
      const response = await CandidatesAPI.getAll(
        { sortBy: 'name' },
        { page, limit: TOTAL_CANDIDATES_MODAL_PAGE_SIZE }
      )
      const raw = response.data || []
      const p = response.pagination || {}
      const totalPages = Math.max(1, p.totalPages ?? 1)
      const total = typeof p.total === 'number' ? p.total : raw.length
      setTotalCandidatesModal({
        page: p.page ?? page,
        totalPages,
        total,
        items: mapApiCandidatesToDashboardItems(raw),
        loading: false,
      })
    } catch (error: any) {
      console.error('Error loading candidates list:', error)
      setTotalCandidatesModal({
        page: 1,
        totalPages: 1,
        total: 0,
        items: [],
        loading: false,
      })
    }
  }

  const positionEdit = usePositionEditOverlay(() => {
    void loadDashboardData()
  })

  const openFptkEdit = (id?: string, backLabel = 'Dashboard') => {
    if (!id) return
    void positionEdit.open(id, backLabel)
  }

  const openFptkView = async (id?: string) => {
    if (!id) return
    setSlaPositionView({ isOpen: false, jobPosting: null, loading: true })
    try {
      const data = await FPTKAPI.getById(id)
      setSlaPositionView({ isOpen: true, jobPosting: mapApiFptk(data), loading: false })
    } catch {
      setSlaPositionView({ isOpen: false, jobPosting: null, loading: false })
    }
  }

  const closeFptkView = () => {
    setSlaPositionView({ isOpen: false, jobPosting: null, loading: false })
  }

  const openCandidateView = (id?: string) => {
    if (!id) return
    setDetailModal(null)
    setTotalCandidatesModal(null)
    setTotalCandidatesQuery('')
    router.push(`/candidates?view=${encodeURIComponent(id)}`)
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-32 gap-4 text-gray-500">
          <Spinner size="lg" />
          <p className="text-sm font-medium">Loading dashboard…</p>
        </div>
      </Layout>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <Layout>
      <div>
        <div className="mb-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
              <p className="mt-0.5 text-xs text-gray-500">
                KPN Talent Acquisition System
              </p>
            </div>
            <button
              onClick={() => loadDashboardData(currentParams)}
              disabled={isDashboardLoading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isDashboardLoading ? (
                <Spinner size="sm" className="mr-2" />
              ) : (
                <ArrowPathIcon className="h-4 w-4 mr-2" />
              )}
              {isDashboardLoading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Unified Filter Toolbar */}
        <div
          className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 bg-white border border-gray-200 rounded-lg shadow-sm px-4 py-2.5"
          data-tour="dashboard-time-filter"
        >
          {/* Priority */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Priority</span>
            <div className="inline-flex rounded-md shadow-sm">
              {PRIORITY_FILTERS.map((filter, index) => (
                <button
                  key={filter}
                  onClick={() => setPriorityFilter(filter)}
                  className={`px-2.5 py-1 border text-xs font-medium ${
                    filter === priorityFilter
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  } ${index === 0 ? 'rounded-l-md' : ''} ${
                    index === PRIORITY_FILTERS.length - 1 ? 'rounded-r-md' : ''
                  } ${index > 0 ? '-ml-px' : ''}`}
                >
                  {filter === 'ALL' ? 'All' : filter}
                </button>
              ))}
            </div>
          </div>

          <div className="h-4 w-px bg-gray-200 hidden sm:block" aria-hidden="true" />

          {/* Position Status */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Status</span>
            <div className="inline-flex rounded-md shadow-sm">
              {POSITION_STATUS_FILTERS.map((filter, index) => (
                <button
                  key={filter}
                  onClick={() => setPositionStatusFilter(filter)}
                  className={`px-2.5 py-1 border text-xs font-medium ${
                    filter === positionStatusFilter
                      ? filter === 'OPEN'
                        ? 'bg-green-600 text-white border-green-600'
                        : filter === 'CLOSED'
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  } ${index === 0 ? 'rounded-l-md' : ''} ${
                    index === POSITION_STATUS_FILTERS.length - 1 ? 'rounded-r-md' : ''
                  } ${index > 0 ? '-ml-px' : ''}`}
                >
                  {filter === 'ALL' ? 'All' : filter === 'OPEN' ? 'Open' : 'Closed'}
                </button>
              ))}
            </div>
          </div>

          <div className="h-4 w-px bg-gray-200 hidden sm:block" aria-hidden="true" />

          {/* Area */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Area</span>
            <div className="inline-flex rounded-md shadow-sm">
              {LOCATION_AREA_FILTERS.map((filter, index) => (
                <button
                  key={filter}
                  onClick={() => setLocationAreaFilter(filter)}
                  className={`px-2.5 py-1 border text-xs font-medium ${
                    filter === locationAreaFilter
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  } ${index === 0 ? 'rounded-l-md' : ''} ${
                    index === LOCATION_AREA_FILTERS.length - 1 ? 'rounded-r-md' : ''
                  } ${index > 0 ? '-ml-px' : ''}`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Spacer — pushes Compare section to the right */}
          <div className="flex-1 hidden sm:block" />
          <div className="h-4 w-px bg-gray-200 hidden sm:block" aria-hidden="true" />

          {/* Compare to Previous */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Compare</span>
            <button
              type="button"
              role="switch"
              aria-checked={compareToPrevious}
              aria-label="Compare to Previous Period"
              onClick={() => setCompareToPrevious((v) => !v)}
              className={`relative h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                compareToPrevious ? 'bg-indigo-600' : 'bg-gray-300'
              }`}
            >
              <span
                aria-hidden
                className={`pointer-events-none absolute top-0 left-0 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${
                  compareToPrevious ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>

            {compareToPrevious && (
              <>
                <div className="inline-flex rounded-md shadow-sm">
                  {(['week', 'month', 'custom'] as const).map((m, index, arr) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setTimeMode(m)}
                      className={`px-2.5 py-1 border text-xs font-medium capitalize ${
                        timeMode === m
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                      } ${index === 0 ? 'rounded-l-md' : ''} ${
                        index === arr.length - 1 ? 'rounded-r-md' : ''
                      } ${index > 0 ? '-ml-px' : ''}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                {timeMode === 'week' && (
                  <input
                    type="week"
                    value={weekValue}
                    onChange={(e) => setWeekValue(e.target.value)}
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                  />
                )}
                {timeMode === 'month' && (
                  <input
                    type="month"
                    value={monthValue}
                    onChange={(e) => setMonthValue(e.target.value)}
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                  />
                )}
                {timeMode === 'custom' && (
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
                    <label className="flex items-center gap-1">
                      From
                      <input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                      />
                    </label>
                    <label className="flex items-center gap-1">
                      To
                      <input
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                      />
                    </label>
                  </div>
                )}
                {customRangeInvalid && (
                  <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 whitespace-nowrap">
                    Invalid range — using current month
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" data-tour="dashboard-analytics">
          {stats.map((item) => (
            <button
              key={item.name}
              className="text-left relative overflow-hidden rounded-lg bg-white px-3 py-2.5 shadow hover:ring-2 hover:ring-indigo-500 focus:outline-none"
              onClick={async () => {
                if (item.name === 'Total Candidates') {
                  setTotalCandidatesQuery('')
                  setTotalCandidatesModal({
                    page: 1,
                    totalPages: 1,
                    total: 0,
                    items: [],
                    loading: true,
                  })
                  await loadTotalCandidatesModalPage(1)
                  return
                }
                if (item.name === 'Open Positions') {
                  setOpenPositionsPage(1)
                  setOpenPositionsModalOpen(true)
                  if (!openPositionsLoadedOnceRef.current) {
                    await fetchOpenPositions('')
                  }
                  return
                }
                setDetailModal({ title: item.name, items: [] })
                try {
                  const items = await loadModalItems(item.name)
                  setDetailModal({
                    title: item.name,
                    items: items.length
                      ? items
                      : [{ title: 'No data available', subtitle: 'Try adjusting filters to see more results', meta: 'No data' }],
                  })
                } catch (error: any) {
                  console.error(`Error loading ${item.name} details:`, error)
                  setDetailModal({ title: item.name, items: [] })
                }
              }}
            >
              <dt>
                <div className="absolute rounded-md bg-indigo-500 p-2">
                  <item.icon className="h-5 w-5 text-white" aria-hidden="true" />
                </div>
                <p className="ml-12 truncate text-sm font-medium text-gray-500">
                  {item.name}
                </p>
              </dt>
              <dd className="ml-12 flex items-baseline pb-1">
                {isDashboardLoading ? (
                  <div className="h-7 w-12 animate-pulse rounded bg-gray-200" />
                ) : (
                  <p className="text-xl font-semibold text-gray-900 underline decoration-dotted">{item.value}</p>
                )}
                {compareToPrevious && !isDashboardLoading ? (
                  <p
                    className={`ml-2 flex items-baseline text-sm font-semibold ${
                      item.changeType === 'positive'
                        ? 'text-green-600'
                        : item.changeType === 'negative'
                          ? 'text-red-600'
                          : 'text-gray-500'
                    }`}
                  >
                    {item.change}
                  </p>
                ) : null}
              </dd>
            </button>
          ))}
        </div>

        {openPositionsModalOpen && (
          <div
            className={[
              'fixed inset-0 bg-black/40 z-50 flex items-center justify-center transition-opacity duration-200',
              positionEdit.isOpen ? 'opacity-45 pointer-events-none' : '',
            ].join(' ')}
            onClick={() => setOpenPositionsModalOpen(false)}
          >
            <div
              className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Open Positions</h2>
                  <div className="text-xs text-gray-500">Search by Position Name, then click to edit.</div>
                </div>
                <button className="text-gray-500 hover:text-gray-700" onClick={() => setOpenPositionsModalOpen(false)}>
                  ✕
                </button>
              </div>

              <div className="px-6 py-4">
                <div className="flex gap-2">
                  <input
                    value={openPositionsQuery}
                    onChange={(e) => setOpenPositionsQuery(e.target.value)}
                    placeholder="Search position name..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                    disabled={openPositionsLoading}
                    onClick={() => fetchOpenPositions(openPositionsQuery)}
                  >
                    Search
                  </button>
                </div>

                {openPositionsError ? (
                  <div className="mt-3 text-sm text-red-600">{openPositionsError}</div>
                ) : null}

                <div className="mt-4 max-h-[60vh] overflow-auto border rounded-md">
                  {openPositionsLoading ? (
                    <div className="p-4 text-sm text-gray-500">Loading…</div>
                  ) : openPositionsMeta.total === 0 ? (
                    <div className="p-4 text-sm text-gray-500">No open positions found.</div>
                  ) : (
                    <ul className="divide-y">
                      {openPositionsMeta.pagedItems.map((p: any) => {
                        const title = p?.title || p?.position || 'Unknown Position'
                        const sub = `${p?.department || 'N/A'} • ${p?.location || 'N/A'}`
                        const meta = p?.currentStatus || p?.status || 'N/A'
                        return (
                          <li key={p.id} className="px-4 py-3 hover:bg-gray-50">
                            <button
                              className="w-full text-left"
                              onClick={() => {
                                openFptkEdit(p.id, 'Open Positions')
                              }}
                            >
                              <div className="text-sm font-medium text-indigo-700 hover:underline">{title}</div>
                              <div className="text-sm text-gray-600">{sub}</div>
                              <div className="text-xs text-gray-500 mt-1">{meta}</div>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>

              <div className="px-6 py-4 border-t flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-gray-500">
                  Page {openPositionsMeta.safePage} of {openPositionsMeta.totalPages} · {openPositionsMeta.total} total
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={openPositionsLoading || openPositionsMeta.safePage <= 1}
                    onClick={() => setOpenPositionsPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={openPositionsLoading || openPositionsMeta.safePage >= openPositionsMeta.totalPages}
                    onClick={() => setOpenPositionsPage((p) => p + 1)}
                    className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                  <button
                    className="px-4 py-2 text-sm rounded-md border text-gray-700 bg-white hover:bg-gray-50"
                    onClick={() => setOpenPositionsModalOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {totalCandidatesModal && (
          <div
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
            onClick={() => {
              setTotalCandidatesModal(null)
              setTotalCandidatesQuery('')
            }}
          >
            <div
              className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b flex items-center justify-between gap-3 shrink-0">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Total Candidates</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Sorted A–Z by name · {TOTAL_CANDIDATES_MODAL_PAGE_SIZE} per page
                  </p>
                </div>
                <button
                  className="text-gray-500 hover:text-gray-700"
                  onClick={() => {
                    setTotalCandidatesModal(null)
                    setTotalCandidatesQuery('')
                  }}
                >
                  ✕
                </button>
              </div>

              <div className="px-6 py-3 border-b shrink-0">
                <input
                  value={totalCandidatesQuery}
                  onChange={(e) => setTotalCandidatesQuery(e.target.value)}
                  placeholder="Filter this page by name or email…"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="px-6 py-4 overflow-auto flex-1 min-h-0">
                {totalCandidatesModal.loading ? (
                  <div className="text-sm text-gray-500 py-8 text-center">Loading…</div>
                ) : (
                  <ul className="divide-y">
                    {totalCandidatesModal.items
                      .filter((it) => matchesQuery(it, totalCandidatesQuery))
                      .map((it: DashboardListItem, idx: number) => (
                        <li key={it.id || idx} className="py-3">
                          <button
                            className="w-full text-left"
                            onClick={() => openCandidateView(it.id)}
                          >
                            <div className="text-sm font-medium text-indigo-700 hover:underline">{it.title}</div>
                            {it.subtitle && <div className="text-sm text-gray-600">{it.subtitle}</div>}
                            {it.meta && <div className="text-xs text-gray-500 mt-1">{it.meta}</div>}
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
                {!totalCandidatesModal.loading &&
                  totalCandidatesModal.items.filter((it) => matchesQuery(it, totalCandidatesQuery)).length ===
                    0 && (
                    <div className="text-sm text-gray-500 py-4">No candidates on this page match your filter.</div>
                  )}
              </div>

              <div className="px-6 py-4 border-t flex flex-wrap items-center justify-between gap-3 shrink-0">
                <p className="text-xs text-gray-500">
                  Page {totalCandidatesModal.page} of {totalCandidatesModal.totalPages} ·{' '}
                  {totalCandidatesModal.total} total
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={totalCandidatesModal.loading || totalCandidatesModal.page <= 1}
                    onClick={() => loadTotalCandidatesModalPage(totalCandidatesModal.page - 1)}
                    className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={
                      totalCandidatesModal.loading ||
                      totalCandidatesModal.page >= totalCandidatesModal.totalPages
                    }
                    onClick={() => loadTotalCandidatesModalPage(totalCandidatesModal.page + 1)}
                    className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTotalCandidatesModal(null)
                      setTotalCandidatesQuery('')
                    }}
                    className="px-3 py-1.5 text-sm rounded-md border text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Charts Section - Location aligned view */}
        <div className="mt-4 bg-white shadow rounded-lg">
          <div className="px-4 py-4 sm:px-6">
            <div className="flex items-center mb-3">
              <h3 className="text-base font-semibold text-gray-900">
                Location Overview
              </h3>
            </div>
            <div className="hidden lg:grid grid-cols-3 gap-4 text-xs font-semibold text-gray-500 border-b pb-2 mb-4">
              <span>Location</span>
              <span>Position Status by Location</span>
              <span>SLA by Location (from FPTK Receive Date)</span>
            </div>

            {combinedLocations.length === 0 ? (
              <div className="text-sm text-gray-500">
                No location data available. Create some positions to see the chart.
              </div>
            ) : (
              <div className="space-y-2">
                {combinedLocations.map((locationKey) => {
                  const statusData = dashboardStats.positionStatusByLocation.find(
                    (l: any) => l.location === locationKey
                  )
                  const progressData = dashboardStats.openPositionProgress.find(
                    (l: any) => l.areaDetail === locationKey
                  )
                  const slaData = dashboardStats.slaByLocation.find(
                    (l: any) => l.areaDetail === locationKey
                  )

                  return (
                    <div
                      key={locationKey}
                      className="border rounded-lg p-3 hover:border-indigo-300 transition-colors"
                    >
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
                        {/* Location label */}
                        <div>
                          <div className="text-sm font-semibold text-gray-900 mb-1">
                            {locationKey}
                          </div>
                          <div className="text-xs text-gray-500">
                            {(statusData?.total || progressData?.total || slaData?.total || 0).toString()}{' '}
                            total records
                          </div>
                        </div>

                        {/* Position Status by Location */}
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex justify-between items-center mb-2">
                            <div className="text-xs font-medium text-gray-700">
                              Position Status
                            </div>
                            {statusData && (
                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                                <span className="text-gray-500">
                                  Total: <span className="font-semibold text-gray-700">{statusData.total}</span>
                                </span>
                                <Link
                                  href={`/summary-by-position?location=${encodeURIComponent(statusData.location)}&card=open`}
                                  className="text-green-600 hover:underline font-medium"
                                  title="View open positions in Summary by Position"
                                >
                                  Open: <span className="font-semibold">{statusData.open}</span> ↗
                                </Link>
                                <Link
                                  href={`/summary-by-position?location=${encodeURIComponent(statusData.location)}&card=closed`}
                                  className="text-red-600 hover:underline font-medium"
                                  title="View closed positions in Summary by Position"
                                >
                                  Closed: <span className="font-semibold">{statusData.closed}</span> ↗
                                </Link>
                              </div>
                            )}
                          </div>
                          {statusData ? (
                            <div className="relative">
                              <div className="flex items-end space-x-1 h-8">
                                <div className="flex-1 flex flex-col items-center">
                                  <div
                                    className="bg-green-500 rounded-t w-full transition-all duration-300 hover:bg-green-600"
                                    style={{
                                      height: `${Math.max(
                                        (statusData.open / statusData.total) * 100,
                                        5
                                      )}%`,
                                      minHeight: statusData.open > 0 ? '8px' : '0px',
                                    }}
                                    title={`Open: ${statusData.open}`}
                                  ></div>
                                  <span className="text-[10px] text-gray-500 mt-1">Open</span>
                                </div>
                                <div className="flex-1 flex flex-col items-center">
                                  <div
                                    className="bg-red-500 rounded-t w-full transition-all duration-300 hover:bg-red-600"
                                    style={{
                                      height: `${Math.max(
                                        (statusData.closed / statusData.total) * 100,
                                        5
                                      )}%`,
                                      minHeight: statusData.closed > 0 ? '8px' : '0px',
                                    }}
                                    title={`Closed: ${statusData.closed}`}
                                  ></div>
                                  <span className="text-[10px] text-gray-500 mt-1">Closed</span>
                                </div>
                              </div>
                              <div className="flex justify-between mt-2 text-[10px] text-gray-500">
                                <span>
                                  {Math.round((statusData.open / statusData.total) * 100)}% Open
                                </span>
                                <span>
                                  {Math.round((statusData.closed / statusData.total) * 100)}% Closed
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-400">No data.</div>
                          )}
                        </div>

                        {/* SLA by Location */}
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex justify-between items-center mb-1">
                            <div className="text-xs font-medium text-gray-700">SLA</div>
                            {slaData && (
                              <div className="text-[11px] text-gray-600">
                                <span className="font-semibold">{slaData.total}</span> positions
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mb-2">
                            <span className="flex items-center gap-1 text-[9px] text-emerald-600 font-medium">
                              <span>✓</span>
                              <span className="text-gray-500 font-normal">FKTK Received</span>
                            </span>
                            <span className="flex items-center gap-1 text-[9px] text-amber-500 font-medium">
                              <span>⏳</span>
                              <span className="text-gray-500 font-normal">FKTK Pending</span>
                            </span>
                          </div>
                          {slaData ? (
                            <div className="space-y-1.5">
                              {Object.entries(slaData.buckets).map(
                                ([bucket, counts]: [string, any]) => {
                                  const bucketTotal = (counts?.received ?? 0) + (counts?.pending ?? 0)
                                  const openModal = () => {
                                    const modalTitle = `${bucket} • ${slaData.areaDetail}`
                                    setDetailModal({ title: modalTitle, items: [] })
                                    FPTKAPI.getAll({}, { limit: 500 })
                                      .then((res) => {
                                        const data = Array.isArray(res?.data) ? res.data : []
                                        const nowDate = new Date()
                                        const items = data
                                          .filter((j: any) => {
                                            // Match location using the same fallback as dashboardService
                                            const loc = j?.areaDetail || j?.area || 'Unknown'
                                            if (loc !== slaData.areaDetail) return false
                                            const dateValue = j?.fptkReceiveDate || j?.requestDate
                                            if (!dateValue) return false
                                            const d = new Date(dateValue)
                                            if (isNaN(d.getTime())) return false
                                            const diffDays = businessDaysDiffIndonesia(d, nowDate)
                                            if (bucket === '0-30 Days') return diffDays <= 30
                                            if (bucket === '31-60 Days') return diffDays > 30 && diffDays <= 60
                                            if (bucket === '61-90 Days') return diffDays > 60 && diffDays <= 90
                                            return diffDays > 90
                                          })
                                          .map((j: any) => ({
                                            id: j.id,
                                            kind: 'fptk',
                                            title: j.positionTitle || j.position || 'Unknown Position',
                                            subtitle: `${j.department || 'N/A'} • ${j.areaDetail || j.area || 'N/A'}`,
                                            meta: `FKTK: ${j.statusFktk || 'Pending'} • FPTK Received: ${j.fptkReceiveDate || j.requestDate ? new Date(j.fptkReceiveDate || j.requestDate).toLocaleDateString() : '-'}`,
                                          }))
                                        setDetailModal({ title: modalTitle, items })
                                      })
                                      .catch(() => {
                                        setDetailModal({
                                          title: modalTitle,
                                          items: [{ title: 'Failed to load positions', subtitle: 'Please try again', meta: 'Error' }],
                                        })
                                      })
                                  }
                                  return (
                                    <div key={bucket}>
                                      <div className="flex items-center">
                                        <button
                                          className="w-28 text-[10px] text-gray-600 truncate mr-2 text-left hover:text-indigo-600 hover:underline transition-colors"
                                          onClick={openModal}
                                          title={`View positions: ${bucket}`}
                                        >
                                          {bucket}
                                        </button>
                                        <button
                                          className="flex-1 bg-gray-200 rounded-full h-1.5 group"
                                          onClick={openModal}
                                          title={`${bucket}: ${bucketTotal} positions (✓ ${counts?.received ?? 0} received, ⏳ ${counts?.pending ?? 0} pending)`}
                                        >
                                          <div
                                            className="bg-purple-500 h-1.5 rounded-full transition-all duration-300 group-hover:bg-purple-600"
                                            style={{
                                              width: `${
                                                slaData.total > 0
                                                  ? (bucketTotal / slaData.total) * 100
                                                  : 0
                                              }%`,
                                            }}
                                          ></div>
                                        </button>
                                        <button
                                          className="w-6 text-[10px] text-gray-600 text-right ml-2 hover:underline"
                                          onClick={openModal}
                                        >
                                          {bucketTotal}
                                        </button>
                                      </div>
                                      {bucketTotal > 0 && (
                                        <div className="flex items-center gap-2 ml-30 pl-[7.5rem] mt-0.5">
                                          <span
                                            className="text-[9px] text-emerald-600 font-medium"
                                            title="FKTK Received"
                                          >
                                            ✓{counts?.received ?? 0}
                                          </span>
                                          <span
                                            className="text-[9px] text-amber-500 font-medium"
                                            title="FKTK Pending"
                                          >
                                            ⏳{counts?.pending ?? 0}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )
                                }
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-400">No SLA data.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-4">
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-4 sm:px-6">
              <h3 className="text-base font-semibold text-gray-900">
                Quick Actions
              </h3>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <button 
                  onClick={() => router.push('/candidates')}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Add New Candidate
                </button>
                <button 
                  onClick={() => router.push('/fptk')}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Create Position
                </button>
                {/* Removed Schedule Interview as requested */}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-4">
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-4 sm:px-6">
              <h3 className="text-base font-semibold text-gray-900">
                Recent Activity
              </h3>
              <div className="mt-3">
                {dashboardStats.recentActivity.length > 0 ? (
                  <div className="flow-root">
                    <ul className="-mb-8">
                      {dashboardStats.recentActivity.map((activity, activityIdx) => (
                        <li key={activityIdx}>
                          <div className="relative pb-4">
                            {activityIdx !== dashboardStats.recentActivity.length - 1 ? (
                              <span
                                className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                                aria-hidden="true"
                              />
                            ) : null}
                            <div className="relative flex space-x-3">
                              <div>
                                <span className={`h-7 w-7 rounded-full flex items-center justify-center ring-4 ring-white ${
                                  activity.icon === 'user' ? 'bg-indigo-500' : 'bg-green-500'
                                }`}>
                                  {activity.icon === 'user' ? (
                                    <UsersIcon className="h-4 w-4 text-white" />
                                  ) : (
                                    <BriefcaseIcon className="h-4 w-4 text-white" />
                                  )}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1 pt-1 flex justify-between space-x-4">
                                <div>
                                  <p className="text-sm text-gray-500">{activity.message}</p>
                                </div>
                                <div className="text-right text-sm whitespace-nowrap text-gray-500">
                                  <time dateTime={activity.timestamp}>
                                    {new Date(activity.timestamp).toLocaleDateString()}
                                  </time>
                                </div>
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">
                    No recent activity to display. Start by adding candidates or creating positions.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Details Modal */}
      {detailModal && (
        <div
          className={[
            'fixed inset-0 bg-black/40 z-50 flex items-center justify-center transition-opacity duration-200',
            positionEdit.isOpen ? 'opacity-45 pointer-events-none' : '',
          ].join(' ')}
          onClick={() => {
            setDetailModal(null)
            setDetailQuery('')
          }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{detailModal.title}</h2>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => {
                  setDetailModal(null)
                  setDetailQuery('')
                }}
              >
                ✕
              </button>
            </div>
            <div className="max-h-[60vh] overflow-auto px-6 py-4 relative">
              {slaPositionView.loading && (
                <div className="absolute inset-0 bg-white/70 z-10 flex items-center justify-center rounded-b-lg">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <svg className="animate-spin h-4 w-4 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Loading position details…
                  </div>
                </div>
              )}
              <div className="mb-3">
                <input
                  value={detailQuery}
                  onChange={(e) => setDetailQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {detailModal.items.length > 0 ? (
                <ul className="divide-y">
                  {detailModalMeta.pagedItems.map((it: DashboardListItem, idx: number) => {
                      const clickable = !!it.id && (it.kind === 'fptk' || it.kind === 'candidate')
                      const onClick = () => {
                        if (it.kind === 'fptk') return void openFptkView(it.id)
                        if (it.kind === 'candidate') return openCandidateView(it.id)
                      }
                      return (
                        <li key={it.id || idx} className="py-3">
                          {clickable ? (
                            <button className="w-full text-left group" onClick={onClick}>
                              <div className="text-sm font-medium text-indigo-700 group-hover:underline flex items-center gap-1">
                                {it.title}
                                <span className="text-[10px] text-indigo-400 font-normal opacity-0 group-hover:opacity-100 transition-opacity">View details →</span>
                              </div>
                              {it.subtitle && <div className="text-sm text-gray-600">{it.subtitle}</div>}
                              {it.meta && <div className="text-xs text-gray-500 mt-1">{it.meta}</div>}
                            </button>
                          ) : (
                            <>
                              <div className="text-sm font-medium text-gray-900">{it.title}</div>
                              {it.subtitle && <div className="text-sm text-gray-600">{it.subtitle}</div>}
                              {it.meta && <div className="text-xs text-gray-500 mt-1">{it.meta}</div>}
                            </>
                          )}
                        </li>
                      )
                    })}
                </ul>
              ) : (
                <div className="text-sm text-gray-500">No data available.</div>
              )}
            </div>
            <div className="px-6 py-4 border-t flex justify-end">
              <div className="flex w-full items-center justify-between gap-3">
                <p className="text-xs text-gray-500">
                  Page {detailModalMeta.safePage} of {detailModalMeta.totalPages} · {detailModalMeta.total} total
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={detailModalMeta.safePage <= 1}
                    onClick={() => setDetailModalPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={detailModalMeta.safePage >= detailModalMeta.totalPages}
                    onClick={() => setDetailModalPage((p) => p + 1)}
                    className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                  <button
                    className="px-4 py-2 text-sm rounded-md border text-gray-700 bg-white hover:bg-gray-50"
                    onClick={() => {
                      setDetailModal(null)
                      setDetailQuery('')
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <PositionEditOverlay
        isOpen={positionEdit.isOpen}
        jobPosting={positionEdit.jobPosting}
        loading={positionEdit.loading}
        onClose={positionEdit.close}
        onSave={positionEdit.handleSave}
        headerBackLabel={`Back to ${positionEdit.backLabel || 'Dashboard'}`}
      />

      <ViewJobPostingModal
        isOpen={slaPositionView.isOpen}
        onClose={closeFptkView}
        jobPosting={slaPositionView.jobPosting}
      />
    </Layout>
  )
}