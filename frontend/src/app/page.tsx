'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Layout from '@/components/Layout/Layout'
import PositionEditOverlay from '@/components/PositionEditOverlay'
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
import { DashboardStats, PositionStatusByLocation, OpenPositionProgress, SLALocation } from '@/types'
import { DashboardAPI, CandidatesAPI, FPTKAPI, ApplicationsAPI } from '@/lib/api'
import { mapApiFptk } from './fptk/page'
import { businessDaysDiffIndonesia } from '@/utils/indoBusinessDays'
import {
  getDashboardPeriodBounds,
  itemTimestampInRange,
  periodOverPeriodChange,
  toMonthInputValue,
  toWeekInputValue,
  type DashboardTimeMode,
  type DateRange,
} from '@/utils/dashboardPeriod'
import { useModalEscape } from '@/hooks/useModalEscape'
import { usePositionEditOverlay } from '@/hooks/usePositionEditOverlay'

const PRIORITY_FILTERS = ['ALL', 'P0', 'P1', 'P2'] as const

const POSITION_STATUS_FILTERS = ['ALL', 'OPEN', 'CLOSED'] as const
type PositionStatusFilterType = typeof POSITION_STATUS_FILTERS[number]

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

const getCurrentWeekRange = () => {
  const now = new Date()
  const startOfWeek = new Date(now)
  const day = startOfWeek.getDay()
  const diffToMonday = (day + 6) % 7
  startOfWeek.setDate(startOfWeek.getDate() - diffToMonday)
  startOfWeek.setHours(0, 0, 0, 0)

  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)
  return { startOfWeek, endOfWeek }
}

const computePositionStatusByLocation = (positions: any[]): PositionStatusByLocation[] => {
  const data = positions.reduce((acc: Record<string, PositionStatusByLocation>, position: any) => {
    const location = position?.areaDetail || position?.area || position?.location || 'Unknown'
    if (!acc[location]) {
      acc[location] = { location, total: 0, open: 0, closed: 0 }
    }
    acc[location].total += 1
    const cs = position?.currentStatus || position?.status || ''
    if (isOpenCurrentStatusLabel(cs)) {
      acc[location].open += 1
    } else {
      acc[location].closed += 1
    }
    return acc
  }, {} as Record<string, PositionStatusByLocation>)
  return Object.values(data) as PositionStatusByLocation[]
}

const computeOpenPositionProgress = (positions: any[]): OpenPositionProgress[] => {
  const data = positions.reduce((acc: Record<string, OpenPositionProgress>, position: any) => {
    const areaDetail = position?.areaDetail || position?.area || position?.location || 'Unknown'
    const status = position?.currentStatus || position?.status || 'Raise FPTK'

    if (!acc[areaDetail]) {
      acc[areaDetail] = { areaDetail, statusCounts: {} as Record<string, number>, total: 0, percentage: 0 }
    }

    acc[areaDetail].statusCounts[status] = (acc[areaDetail].statusCounts[status] || 0) + 1
    acc[areaDetail].total += 1
    return acc
  }, {} as Record<string, any>)

  const total = positions.length || 1
  return (Object.values(data) as OpenPositionProgress[]).map((entry) => ({
    ...entry,
    percentage: Math.round((entry.total / total) * 100),
  }))
}

const computeSlaByLocation = (positions: any[]): SLALocation[] => {
  const now = new Date()
  const data = positions.reduce((acc: Record<string, SLALocation>, position: any) => {
    const location = position?.areaDetail || position?.area || position?.location || 'Unknown'
    const receivedDate =
      parseDateValue(position?.fptkReceiveDate) || parseDateValue(position?.requestDate)
    if (!receivedDate) return acc

    if (!acc[location]) {
      acc[location] = {
        areaDetail: location,
        buckets: {
          '0-30 Days': 0,
          '31-60 Days': 0,
          '61-90 Days': 0,
          'Above 91 Days': 0,
        },
        total: 0,
      }
    }

    const diffDays = businessDaysDiffIndonesia(receivedDate, now)
    if (diffDays <= 30) acc[location].buckets['0-30 Days'] += 1
    else if (diffDays <= 60) acc[location].buckets['31-60 Days'] += 1
    else if (diffDays <= 90) acc[location].buckets['61-90 Days'] += 1
    else acc[location].buckets['Above 91 Days'] += 1

    acc[location].total += 1
    return acc
  }, {} as Record<string, SLALocation>)

  return Object.values(data) as SLALocation[]
}

const getHiredInRangeItems = (positions: any[], range: DateRange): DashboardListItem[] => {
  return positions
    .filter((position) => {
      const s = normalizeUiCurrentStatus(position?.currentStatus || position?.status)
      if (s !== 'close') return false
      return itemTimestampInRange(position?.updatedAt, range)
    })
    .map((position) => {
      const date = parseDateValue(position?.updatedAt)
      return {
        id: position?.id,
        kind: position?.id ? ('fptk' as const) : undefined,
        title: position?.title || position?.position || 'Unknown Position',
        subtitle: position?.department ? `${position.department} • ${position.location || 'N/A'}` : position?.location,
        meta: date ? `Updated ${date.toLocaleDateString()}` : undefined,
      }
    })
}

const getHiredAllTimeItems = (positions: any[]): DashboardListItem[] => {
  return positions
    .filter((position) => normalizeUiCurrentStatus(position?.currentStatus || position?.status) === 'close')
    .map((position) => {
      const date = parseDateValue(position?.updatedAt)
      return {
        id: position?.id,
        kind: position?.id ? ('fptk' as const) : undefined,
        title: position?.title || position?.position || 'Unknown Position',
        subtitle: position?.department ? `${position.department} • ${position.location || 'N/A'}` : position?.location,
        meta: date ? `Updated ${date.toLocaleDateString()}` : undefined,
      }
    })
}

const asUpperStatus = (value: any) => (value || '').toString().trim().toUpperCase()

const appActivityTs = (a: { updatedAt?: string | null; appliedAt?: string | null } | null | undefined) =>
  a?.updatedAt || a?.appliedAt
const fptkActivityTs = (p: { updatedAt?: string | null; createdAt?: string | null } | null | undefined) =>
  p?.updatedAt || p?.createdAt

const appInGroupInRange = (a: any, group: Set<string>, range: DateRange) =>
  group.has(asUpperStatus(a?.status)) && itemTimestampInRange(appActivityTs(a), range)

const appInGroup = (a: any, group: Set<string>) => group.has(asUpperStatus(a?.status))

const DASHBOARD_COMPARE_OFF_DELTA = {
  formattedChange: '—',
  sentiment: 'neutral' as const,
}

const APPLICATION_STATUS_GROUPS = {
  totalCandidate: new Set(['SUBMITTED', 'SCREENING']),
  interview: new Set(['INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'TECHNICAL_TEST']),
  offeringStage: new Set(['OFFER_PROPOSED', 'OFFER_APPROVED', 'OFFER_ACCEPTED']),
  mcu: new Set(['MEDICAL_CHECKUP_COMPLETED']),
  offerRejected: new Set(['OFFER_REJECTED']),
  rejected: new Set(['REJECTED']),
  withdrawn: new Set(['WITHDRAWN']),
}

const buildApplicationInsights = (
  applications: any[],
  weekRange: { startOfWeek: Date; endOfWeek: Date }
) => {
  const interviewItems: DashboardListItem[] = []

  applications.forEach((application: any) => {
    const appStatus = (application?.status || '').toString().toUpperCase()
    if (appStatus !== 'INTERVIEW_SCHEDULED' && appStatus !== 'INTERVIEW_COMPLETED') {
      return
    }

    const candidateName =
      `${application?.candidate?.user?.firstName || ''} ${application?.candidate?.user?.lastName || ''}`.trim() ||
      application?.candidate?.fullName ||
      'Unknown Candidate'
    const positionTitle =
      application?.fptk?.positionTitle ||
      application?.fptk?.position ||
      application?.fptk?.department ||
      'Unknown Position'

    ;(application?.interviews || []).forEach((interview: any) => {
      if (!interview?.scheduledAt) return
      const scheduledAt = new Date(interview.scheduledAt)
      if (isNaN(scheduledAt.getTime())) return
      const status = (interview?.status || '').toString().toUpperCase()
      if (
        isWithinRange(scheduledAt, weekRange.startOfWeek, weekRange.endOfWeek) &&
        (status === 'SCHEDULED' || status === 'CONFIRMED')
      ) {
        const interviewerName =
          interview?.interviewer?.firstName || interview?.interviewer?.lastName
            ? `${interview.interviewer.firstName || ''} ${interview.interviewer.lastName || ''}`.trim()
            : interview?.interviewerName || ''
        const metaParts = [
          scheduledAt.toLocaleDateString(),
          interview?.duration ? `${interview.duration} min` : '',
          interviewerName,
        ].filter(Boolean)

        interviewItems.push({
          id: application?.fptkId,
          kind: application?.fptkId ? ('fptk' as const) : undefined,
          title: candidateName,
          subtitle: `${positionTitle} • ${application?.fptk?.department || 'N/A'}`,
          meta: metaParts.join(' • '),
        })
      }
    })
  })

  return { interviewItems }
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
  const [baseStats, setBaseStats] = useState<Partial<DashboardStats> | null>(null)
  const [allPositions, setAllPositions] = useState<any[]>([])
  const [dashboardApplications, setDashboardApplications] = useState<any[]>([])
  const [fptkListHydrated, setFptkListHydrated] = useState(false)
  const [priorityFilter, setPriorityFilter] = useState<typeof PRIORITY_FILTERS[number]>('ALL')
  const [positionStatusFilter, setPositionStatusFilter] = useState<PositionStatusFilterType>('ALL')
  const [interviewDetailItems, setInterviewDetailItems] = useState<DashboardListItem[]>([])
  const [isLoadingApplicationInsights, setIsLoadingApplicationInsights] = useState(false)
  const [applicationInsightsLoaded, setApplicationInsightsLoaded] = useState(false)
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

  const filteredPositions = useMemo(() => {
    let positions = filterPositionsByPriority(allPositions, priorityFilter)
    if (positionStatusFilter === 'OPEN') {
      positions = positions.filter((p: any) => !isClosedPositionStatus(p?.currentStatus || p?.status))
    } else if (positionStatusFilter === 'CLOSED') {
      positions = positions.filter((p: any) => isClosedPositionStatus(p?.currentStatus || p?.status))
    }
    return positions
  }, [allPositions, priorityFilter, positionStatusFilter])

  const openPositionItems = useMemo<DashboardListItem[]>(() => {
    const openOnly = filteredPositions.filter((position) =>
      isOpenCurrentStatusLabel(position?.currentStatus || position?.status)
    )
    const rows = compareToPrevious
      ? openOnly.filter((position) =>
          itemTimestampInRange(fptkActivityTs(position), activePeriod.current)
        )
      : openOnly
    return rows.map((position) => ({
      id: position?.id,
      kind: 'fptk' as const,
      title: position?.title || position?.position || 'Unknown Position',
      subtitle: `${position?.department || 'N/A'} • ${position?.location || 'N/A'}`,
      meta: position?.currentStatus || position?.status || 'N/A',
    }))
  }, [filteredPositions, activePeriod, compareToPrevious])

  const closedPositionItems = useMemo<DashboardListItem[]>(() => {
    return filteredPositions
      .filter((position) => isClosedCurrentStatusLabel(position?.currentStatus || position?.status))
      .map((position) => ({
        id: position?.id,
        kind: 'fptk' as const,
        title: position?.title || position?.position || 'Unknown Position',
        subtitle: `${position?.department || 'N/A'} • ${position?.location || 'N/A'}`,
        meta: position?.currentStatus || position?.status || 'N/A',
      }))
  }, [filteredPositions])

  const holdPositionItems = useMemo<DashboardListItem[]>(() => {
    return filteredPositions
      .filter((position) => isHoldCurrentStatusLabel(position?.currentStatus || position?.status))
      .map((position) => ({
        id: position?.id,
        kind: 'fptk' as const,
        title: position?.title || position?.position || 'Unknown Position',
        subtitle: `${position?.department || 'N/A'} • ${position?.location || 'N/A'}`,
        meta: position?.currentStatus || position?.status || 'N/A',
      }))
  }, [filteredPositions])

  const hiredInPeriodItems = useMemo(
    () =>
      compareToPrevious
        ? getHiredInRangeItems(filteredPositions, activePeriod.current)
        : getHiredAllTimeItems(filteredPositions),
    [filteredPositions, activePeriod, compareToPrevious]
  )

  const applicationsScoped = useMemo(() => {
    if (!dashboardApplications.length) return []
    if (!fptkListHydrated) return dashboardApplications
    const idSet = new Set(filteredPositions.map((p: any) => p?.id).filter(Boolean))
    if (idSet.size === 0) return []
    return dashboardApplications.filter((a: any) => a.fptkId && idSet.has(a.fptkId))
  }, [dashboardApplications, filteredPositions, fptkListHydrated])

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

  const totalCandidateItems = useMemo(
    () =>
      applicationsScoped
        .filter((a: any) =>
          compareToPrevious
            ? appInGroupInRange(a, APPLICATION_STATUS_GROUPS.totalCandidate, activePeriod.current)
            : appInGroup(a, APPLICATION_STATUS_GROUPS.totalCandidate)
        )
        .map(mapApplicationToDetailItem),
    [applicationsScoped, activePeriod, compareToPrevious]
  )

  const interviewItems = useMemo(
    () =>
      applicationsScoped
        .filter((a: any) =>
          compareToPrevious
            ? appInGroupInRange(a, APPLICATION_STATUS_GROUPS.interview, activePeriod.current)
            : appInGroup(a, APPLICATION_STATUS_GROUPS.interview)
        )
        .map(mapApplicationToDetailItem),
    [applicationsScoped, activePeriod, compareToPrevious]
  )

  const offeringStageItems = useMemo(
    () =>
      applicationsScoped
        .filter((a: any) =>
          compareToPrevious
            ? appInGroupInRange(a, APPLICATION_STATUS_GROUPS.offeringStage, activePeriod.current)
            : appInGroup(a, APPLICATION_STATUS_GROUPS.offeringStage)
        )
        .map(mapApplicationToDetailItem),
    [applicationsScoped, activePeriod, compareToPrevious]
  )

  const mcuItems = useMemo(
    () =>
      applicationsScoped
        .filter((a: any) =>
          compareToPrevious
            ? appInGroupInRange(a, APPLICATION_STATUS_GROUPS.mcu, activePeriod.current)
            : appInGroup(a, APPLICATION_STATUS_GROUPS.mcu)
        )
        .map(mapApplicationToDetailItem),
    [applicationsScoped, activePeriod, compareToPrevious]
  )

  const offerRejectedItems = useMemo(
    () =>
      applicationsScoped
        .filter((a: any) =>
          compareToPrevious
            ? appInGroupInRange(a, APPLICATION_STATUS_GROUPS.offerRejected, activePeriod.current)
            : appInGroup(a, APPLICATION_STATUS_GROUPS.offerRejected)
        )
        .map(mapApplicationToDetailItem),
    [applicationsScoped, activePeriod, compareToPrevious]
  )

  const rejectedItems = useMemo(
    () =>
      applicationsScoped
        .filter((a: any) =>
          compareToPrevious
            ? appInGroupInRange(a, APPLICATION_STATUS_GROUPS.rejected, activePeriod.current)
            : appInGroup(a, APPLICATION_STATUS_GROUPS.rejected)
        )
        .map(mapApplicationToDetailItem),
    [applicationsScoped, activePeriod, compareToPrevious]
  )

  const withdrawnItems = useMemo(
    () =>
      applicationsScoped
        .filter((a: any) =>
          compareToPrevious
            ? appInGroupInRange(a, APPLICATION_STATUS_GROUPS.withdrawn, activePeriod.current)
            : appInGroup(a, APPLICATION_STATUS_GROUPS.withdrawn)
        )
        .map(mapApplicationToDetailItem),
    [applicationsScoped, activePeriod, compareToPrevious]
  )

  const countOpenFptkInRange = useCallback(
    (range: DateRange) =>
      filteredPositions.filter(
        (p) =>
          isOpenCurrentStatusLabel(p?.currentStatus || p?.status) && itemTimestampInRange(fptkActivityTs(p), range)
      ).length,
    [filteredPositions]
  )

  const countAppGroupInRange = useCallback(
    (group: Set<string>, range: DateRange) =>
      applicationsScoped.filter((a: any) => appInGroupInRange(a, group, range)).length,
    [applicationsScoped]
  )

  const countHiredCloseInRange = useCallback(
    (range: DateRange) =>
      filteredPositions.filter(
        (p) =>
          normalizeUiCurrentStatus(p?.currentStatus || p?.status) === 'close' &&
          itemTimestampInRange(fptkActivityTs(p), range)
      ).length,
    [filteredPositions]
  )

  const wowOpenPositions = useMemo(
    () =>
      compareToPrevious
        ? periodOverPeriodChange(
            countOpenFptkInRange(activePeriod.current),
            countOpenFptkInRange(activePeriod.previous)
          )
        : DASHBOARD_COMPARE_OFF_DELTA,
    [compareToPrevious, countOpenFptkInRange, activePeriod]
  )

  const wowTotalCandidateStatus = useMemo(
    () =>
      compareToPrevious
        ? periodOverPeriodChange(
            countAppGroupInRange(APPLICATION_STATUS_GROUPS.totalCandidate, activePeriod.current),
            countAppGroupInRange(APPLICATION_STATUS_GROUPS.totalCandidate, activePeriod.previous)
          )
        : DASHBOARD_COMPARE_OFF_DELTA,
    [compareToPrevious, countAppGroupInRange, activePeriod]
  )

  const wowInterviewStatus = useMemo(
    () =>
      compareToPrevious
        ? periodOverPeriodChange(
            countAppGroupInRange(APPLICATION_STATUS_GROUPS.interview, activePeriod.current),
            countAppGroupInRange(APPLICATION_STATUS_GROUPS.interview, activePeriod.previous)
          )
        : DASHBOARD_COMPARE_OFF_DELTA,
    [compareToPrevious, countAppGroupInRange, activePeriod]
  )

  const wowOfferingStatus = useMemo(
    () =>
      compareToPrevious
        ? periodOverPeriodChange(
            countAppGroupInRange(APPLICATION_STATUS_GROUPS.offeringStage, activePeriod.current),
            countAppGroupInRange(APPLICATION_STATUS_GROUPS.offeringStage, activePeriod.previous)
          )
        : DASHBOARD_COMPARE_OFF_DELTA,
    [compareToPrevious, countAppGroupInRange, activePeriod]
  )

  const wowMcuStatus = useMemo(
    () =>
      compareToPrevious
        ? periodOverPeriodChange(
            countAppGroupInRange(APPLICATION_STATUS_GROUPS.mcu, activePeriod.current),
            countAppGroupInRange(APPLICATION_STATUS_GROUPS.mcu, activePeriod.previous)
          )
        : DASHBOARD_COMPARE_OFF_DELTA,
    [compareToPrevious, countAppGroupInRange, activePeriod]
  )

  const wowOfferRejected = useMemo(
    () =>
      compareToPrevious
        ? periodOverPeriodChange(
            countAppGroupInRange(APPLICATION_STATUS_GROUPS.offerRejected, activePeriod.current),
            countAppGroupInRange(APPLICATION_STATUS_GROUPS.offerRejected, activePeriod.previous)
          )
        : DASHBOARD_COMPARE_OFF_DELTA,
    [compareToPrevious, countAppGroupInRange, activePeriod]
  )

  const wowRejected = useMemo(
    () =>
      compareToPrevious
        ? periodOverPeriodChange(
            countAppGroupInRange(APPLICATION_STATUS_GROUPS.rejected, activePeriod.current),
            countAppGroupInRange(APPLICATION_STATUS_GROUPS.rejected, activePeriod.previous)
          )
        : DASHBOARD_COMPARE_OFF_DELTA,
    [compareToPrevious, countAppGroupInRange, activePeriod]
  )

  const wowWithdrawn = useMemo(
    () =>
      compareToPrevious
        ? periodOverPeriodChange(
            countAppGroupInRange(APPLICATION_STATUS_GROUPS.withdrawn, activePeriod.current),
            countAppGroupInRange(APPLICATION_STATUS_GROUPS.withdrawn, activePeriod.previous)
          )
        : DASHBOARD_COMPARE_OFF_DELTA,
    [compareToPrevious, countAppGroupInRange, activePeriod]
  )

  const wowHiredRolling = useMemo(
    () =>
      compareToPrevious
        ? periodOverPeriodChange(
            countHiredCloseInRange(activePeriod.current),
            countHiredCloseInRange(activePeriod.previous)
          )
        : DASHBOARD_COMPARE_OFF_DELTA,
    [compareToPrevious, countHiredCloseInRange, activePeriod]
  )

  const openPositionsHeadline = useMemo(
    () => openPositionItems.length,
    [openPositionItems.length]
  )

  const totalCandidateHeadline = useMemo(
    () => {
      if (typeof baseStats?.totalCandidates === 'number') {
        return baseStats.totalCandidates
      }
      return totalCandidateItems.length
    },
    [baseStats?.totalCandidates, totalCandidateItems.length]
  )

  const interviewHeadline = useMemo(
    () => interviewItems.length,
    [interviewItems.length]
  )

  const offeringStageHeadline = useMemo(
    () => offeringStageItems.length,
    [offeringStageItems.length]
  )

  const mcuHeadline = useMemo(
    () => mcuItems.length,
    [mcuItems.length]
  )

  const hiredThisMonthHeadline = useMemo(
    () => hiredInPeriodItems.length,
    [hiredInPeriodItems.length]
  )

  const offerRejectedHeadline = useMemo(
    () => offerRejectedItems.length,
    [offerRejectedItems.length]
  )

  const rejectedHeadline = useMemo(() => rejectedItems.length, [rejectedItems.length])

  const withdrawnHeadline = useMemo(() => withdrawnItems.length, [withdrawnItems.length])

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
        value: openPositionsHeadline.toString(),
        icon: BriefcaseIcon,
        change: wowOpenPositions.formattedChange,
        changeType: wowOpenPositions.sentiment,
      },
      {
        name: 'Interview',
        value: interviewHeadline.toString(),
        icon: BriefcaseIcon,
        change: wowInterviewStatus.formattedChange,
        changeType: wowInterviewStatus.sentiment,
      },
      {
        name: 'Offering Stage',
        value: offeringStageHeadline.toString(),
        icon: BriefcaseIcon,
        change: wowOfferingStatus.formattedChange,
        changeType: wowOfferingStatus.sentiment,
      },
      {
        name: 'MCU',
        value: mcuHeadline.toString(),
        icon: CalendarDaysIcon,
        change: wowMcuStatus.formattedChange,
        changeType: wowMcuStatus.sentiment,
      },
      {
        name: 'Hired',
        value: hiredThisMonthHeadline.toString(),
        icon: DocumentTextIcon,
        change: wowHiredRolling.formattedChange,
        changeType: wowHiredRolling.sentiment,
      },
      {
        name: 'Offer Rejected',
        value: offerRejectedHeadline.toString(),
        icon: XCircleIcon,
        change: wowOfferRejected.formattedChange,
        changeType: wowOfferRejected.sentiment,
      },
      {
        name: 'Rejected',
        value: rejectedHeadline.toString(),
        icon: NoSymbolIcon,
        change: wowRejected.formattedChange,
        changeType: wowRejected.sentiment,
      },
      {
        name: 'Withdrawn',
        value: withdrawnHeadline.toString(),
        icon: ArrowLeftOnRectangleIcon,
        change: wowWithdrawn.formattedChange,
        changeType: wowWithdrawn.sentiment,
      },
    ],
    [
      openPositionsHeadline,
      wowOpenPositions,
      totalCandidateHeadline,
      wowTotalCandidateStatus,
      interviewHeadline,
      wowInterviewStatus,
      offeringStageHeadline,
      wowOfferingStatus,
      mcuHeadline,
      wowMcuStatus,
      hiredThisMonthHeadline,
      wowHiredRolling,
      offerRejectedHeadline,
      wowOfferRejected,
      rejectedHeadline,
      wowRejected,
      withdrawnHeadline,
      wowWithdrawn,
      compareToPrevious,
    ]
  )

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    } else if (isAuthenticated) {
      loadDashboardData()
    }
  }, [isAuthenticated, isLoading, router])

  // Load heavy application insights only on-demand (when user opens a detail view).

useEffect(() => {
  if (!baseStats) return

  setDashboardStats({
    totalCandidates: totalCandidateHeadline,
    activeApplications: baseStats.activeApplications ?? 0,
    openPositions: openPositionsHeadline,
    closedPositions: interviewHeadline,
    holdPositions: offeringStageHeadline,
    interviewsThisWeek: mcuHeadline,
    hiredThisMonth: hiredThisMonthHeadline,
    recentActivity: baseStats.recentActivity ?? [],
    positionStatusByLocation: computePositionStatusByLocation(filteredPositions),
    openPositionProgress: computeOpenPositionProgress(filteredPositions),
    slaByLocation: computeSlaByLocation(filteredPositions),
  })
}, [
  baseStats,
  filteredPositions,
  openPositionsHeadline,
  totalCandidateHeadline,
  interviewHeadline,
  offeringStageHeadline,
  mcuHeadline,
  hiredThisMonthHeadline,
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

  const loadApplicationInsights = async (): Promise<DashboardListItem[]> => {
    if (isLoadingApplicationInsights || !isAuthenticated) return []

    setIsLoadingApplicationInsights(true)

    try {
      const limit = 100
      const maxPages = 50 // Safety limit: prevent infinite loops (max 5000 records)
      let page = 1
      let hasMore = true
      const weekRange = getCurrentWeekRange()
      const interviewItems: DashboardListItem[] = []

      while (hasMore && page <= maxPages) {
        const response = await ApplicationsAPI.getAll({}, { page, limit })
        const data = Array.isArray(response?.data) ? response.data : []

        if (data.length === 0) {
          break
        }

        const insights = buildApplicationInsights(data, weekRange)
        interviewItems.push(...insights.interviewItems)

        const totalPages = response?.pagination?.totalPages
        if (totalPages) {
          hasMore = page < totalPages
        } else {
          hasMore = data.length === limit
        }
        page += 1
      }
      
      if (page > maxPages) {
        console.warn(`loadApplicationInsights: Reached maximum page limit (${maxPages}). Some applications may not be loaded.`)
      }

      setInterviewDetailItems(interviewItems)
      setApplicationInsightsLoaded(true)
      return interviewItems
    } catch (error) {
      console.error('Error loading application insights:', error)
      return []
    } finally {
      setIsLoadingApplicationInsights(false)
    }
  }

  const fetchAllFptksForDashboard = async (): Promise<any[]> => {
    if (!isAuthenticated) return []
    const limit = 100
    const maxPages = 30
    let page = 1
    let hasMore = true
    let positions: any[] = []

    while (hasMore && page <= maxPages) {
      const response = await FPTKAPI.getAll({}, { page, limit })
      const data = Array.isArray(response?.data) ? response.data : []
      positions = positions.concat(data.map((fptk: any) => mapApiFptk(fptk)))

      const totalPages = response?.pagination?.totalPages
      if (totalPages) {
        hasMore = page < totalPages
      } else {
        hasMore = data.length === limit
      }
      page += 1
    }

    return positions
  }

  const fetchAllApplicationsForDashboard = async (): Promise<any[]> => {
    if (!isAuthenticated) return []
    const limit = 100
    const maxPages = 50
    let page = 1
    let hasMore = true
    const rows: any[] = []

    while (hasMore && page <= maxPages) {
      const response = await ApplicationsAPI.getAll({}, { page, limit })
      const data = Array.isArray(response?.data) ? response.data : []
      if (data.length === 0) break
      rows.push(...data)
      const totalPages = response?.pagination?.totalPages
      if (totalPages) {
        hasMore = page < totalPages
      } else {
        hasMore = data.length === limit
      }
      page += 1
    }

    if (page > maxPages) {
      console.warn(
        `fetchAllApplicationsForDashboard: Reached max pages (${maxPages}); week-over-week may be incomplete.`
      )
    }

    return rows
  }

  const loadDashboardData = async () => {
    if (!isAuthenticated) return
    try {
      // Load dashboard stats from API
      const stats = await DashboardAPI.getStats()
      console.log('Dashboard API Response:', stats)
      console.log('Position Status by Location:', stats.positionStatusByLocation)
      console.log('Open Position Progress:', stats.openPositionProgress)
      console.log('SLA by Location:', stats.slaByLocation)
      
      // Trust API counts (including 0). Do not fall back to localStorage when the server
      // correctly returns zero — stale jobPostings in localStorage caused Open Positions to
      // show hundreds after all positions were deleted.
      const base = {
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
      }

      console.log('Dashboard base stats:', base)
      console.log('API closedPositions:', stats.closedPositions)
      console.log('API holdPositions:', stats.holdPositions)

      setBaseStats(base)
      setFptkListHydrated(false)
      setAllPositions([])
      setDashboardApplications([])

      Promise.allSettled([fetchAllFptksForDashboard(), fetchAllApplicationsForDashboard()]).then(
        (results) => {
          const pos = results[0].status === 'fulfilled' ? results[0].value : []
          const apps = results[1].status === 'fulfilled' ? results[1].value : []
          if (results[0].status === 'rejected') {
            console.error('fetchAllFptksForDashboard failed:', results[0].reason)
          }
          if (results[1].status === 'rejected') {
            console.error('fetchAllApplicationsForDashboard failed:', results[1].reason)
          }
          setAllPositions(pos)
          setDashboardApplications(apps)
          setFptkListHydrated(true)
        }
      )
    } catch (error: any) {
      console.error('Error loading dashboard data:', error)
      console.error('Error details:', error.response?.data || error.message)
      // Fallback to localStorage if API fails (only in browser)
      let candidates: any[] = []
      let jobPostings: any[] = []
      let applications: any[] = []
      
      if (typeof window !== 'undefined') {
        try {
          const candidatesData = localStorage.getItem('candidates')
          candidates = candidatesData ? JSON.parse(candidatesData) : []
        } catch (error) {
          console.warn('Could not load candidates from localStorage:', error)
        }
        
        try {
          const jobPostingsData = localStorage.getItem('jobPostings')
          jobPostings = jobPostingsData ? JSON.parse(jobPostingsData) : []
        } catch (error) {
          console.warn('Could not load positions from localStorage:', error)
        }
        
        try {
          const applicationsData = localStorage.getItem('applications')
          applications = applicationsData ? JSON.parse(applicationsData) : []
        } catch (error) {
          console.warn('Could not load applications from localStorage:', error)
        }
      }
      
      const totalCandidates = candidates.length
      const activeApplications = applications.length
      const recentActivity = [
        ...candidates.slice(0, 3).map((candidate: any) => ({
          type: 'candidate_added',
          message: `New candidate ${candidate.personalInfo.firstName} ${candidate.personalInfo.lastName} added`,
          timestamp: candidate.createdAt,
          icon: 'user'
        })),
        ...jobPostings.slice(0, 2).map((job: any) => ({
          type: 'job_posting_created',
          message: `New position "${job.title}" created`,
          timestamp: job.createdAt,
          icon: 'briefcase'
        }))
      ]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5)
    
      const fallbackBase = {
        totalCandidates,
        activeApplications,
        recentActivity,
      }
      setBaseStats(fallbackBase)
      setFptkListHydrated(false)
      setAllPositions(jobPostings)
      setDashboardApplications([])

      Promise.allSettled([fetchAllFptksForDashboard(), fetchAllApplicationsForDashboard()]).then(
        (results) => {
          const pos = results[0].status === 'fulfilled' ? results[0].value : []
          const apps = results[1].status === 'fulfilled' ? results[1].value : []
          setAllPositions(pos.length ? pos : jobPostings)
          setDashboardApplications(apps)
          setFptkListHydrated(true)
        }
      )
    }
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

  const openCandidateView = (id?: string) => {
    if (!id) return
    setDetailModal(null)
    setTotalCandidatesModal(null)
    setTotalCandidatesQuery('')
    router.push(`/candidates?view=${encodeURIComponent(id)}`)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <Layout>
      <div>
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="mt-1 text-sm text-gray-500">
                Welcome to the KPN Talent Acquisition System
              </p>
            </div>
            <button
              onClick={loadDashboardData}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <ArrowPathIcon className="h-4 w-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>

        {/* Filter Bar: Priority + Position Status */}
        <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Priority:</span>
            <div className="inline-flex rounded-md shadow-sm">
              {PRIORITY_FILTERS.map((filter, index) => (
                <button
                  key={filter}
                  onClick={() => setPriorityFilter(filter)}
                  className={`px-3 py-1.5 border text-sm font-medium ${
                    filter === priorityFilter
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  } ${index === 0 ? 'rounded-l-md' : ''} ${
                    index === PRIORITY_FILTERS.length - 1 ? 'rounded-r-md' : ''
                  } ${index > 0 ? '-ml-px' : ''}`}
                >
                  {filter === 'ALL' ? 'All' : filter}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Position Status:</span>
            <div className="inline-flex rounded-md shadow-sm">
              {POSITION_STATUS_FILTERS.map((filter, index) => (
                <button
                  key={filter}
                  onClick={() => setPositionStatusFilter(filter)}
                  className={`px-3 py-1.5 border text-sm font-medium ${
                    filter === positionStatusFilter
                      ? filter === 'OPEN'
                        ? 'bg-green-600 text-white border-green-600'
                        : filter === 'CLOSED'
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  } ${index === 0 ? 'rounded-l-md' : ''} ${
                    index === POSITION_STATUS_FILTERS.length - 1 ? 'rounded-r-md' : ''
                  } ${index > 0 ? '-ml-px' : ''}`}
                >
                  {filter === 'ALL' ? 'All' : filter === 'OPEN' ? 'Open' : 'Closed'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div
          className="mb-6 bg-white border border-gray-200 rounded-lg shadow-sm p-4"
          data-tour="dashboard-time-filter"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-800">Compare to Previous</span>
            <button
              type="button"
              role="switch"
              aria-checked={compareToPrevious}
              aria-label="Compare to Previous"
              onClick={() => setCompareToPrevious((v) => !v)}
              className={`relative h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                compareToPrevious ? 'bg-indigo-600' : 'bg-gray-200'
              }`}
            >
              <span
                aria-hidden
                className={`pointer-events-none absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${
                  compareToPrevious ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <div
            className={`mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap ${
              compareToPrevious ? '' : 'opacity-45 pointer-events-none select-none'
            }`}
            aria-hidden={!compareToPrevious}
          >
            <div className="inline-flex rounded-md shadow-sm">
                {(['week', 'month', 'custom'] as const).map((m, index, arr) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setTimeMode(m)}
                    className={`px-3 py-1.5 border text-sm font-medium capitalize ${
                      timeMode === m
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    } ${index === 0 ? 'rounded-l-md' : ''} ${
                      index === arr.length - 1 ? 'rounded-r-md' : ''
                    } ${index > 0 ? '-ml-px' : ''}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              {timeMode === 'week' && (
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="whitespace-nowrap">Week</span>
                  <input
                    type="week"
                    value={weekValue}
                    onChange={(e) => setWeekValue(e.target.value)}
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </label>
              )}
              {timeMode === 'month' && (
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="whitespace-nowrap">Month</span>
                  <input
                    type="month"
                    value={monthValue}
                    onChange={(e) => setMonthValue(e.target.value)}
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </label>
              )}
              {timeMode === 'custom' && (
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                  <label className="flex items-center gap-1">
                    From
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    To
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                </div>
              )}
          </div>
          {compareToPrevious && customRangeInvalid ? (
            <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              Invalid or incomplete custom range. Showing current month until the range is valid.
            </p>
          ) : null}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" data-tour="dashboard-analytics">
          {stats.map((item) => (
            <button
              key={item.name}
              className="text-left relative overflow-hidden rounded-lg bg-white px-3 py-3 shadow hover:ring-2 hover:ring-indigo-500 focus:outline-none"
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
                  let items: DashboardListItem[] = []

                  const mapPositionRow = (position: any): DashboardListItem => ({
                    id: position?.id,
                    kind: 'fptk' as const,
                    title: position?.title || position?.position || 'Unknown Position',
                    subtitle: `${position?.department || 'N/A'} • ${position?.location || 'N/A'}`,
                    meta: position?.currentStatus || position?.status || 'N/A',
                  })

                  if (item.name === 'Interview') {
                    items = interviewItems
                  } else if (item.name === 'Offering Stage') {
                    items = offeringStageItems
                  } else if (item.name === 'MCU') {
                    items = mcuItems
                  } else if (item.name === 'Offer Rejected') {
                    items = offerRejectedItems
                  } else if (item.name === 'Rejected') {
                    items = rejectedItems
                  } else if (item.name === 'Withdrawn') {
                    items = withdrawnItems
                  } else if (item.name === 'Hired') {
                    const pos = await fetchAllFptksForDashboard()
                    setAllPositions(pos)
                    const scoped = filterPositionsByPriority(pos, priorityFilter)
                    items = compareToPrevious
                      ? getHiredInRangeItems(scoped, activePeriod.current)
                      : getHiredAllTimeItems(scoped)
                  }

                  if (!items.length) {
                    items = [
                      {
                        title: 'No data available',
                        subtitle: 'Try adjusting filters to see more results',
                        meta: 'No data',
                      },
                    ]
                  }

                  setDetailModal({ title: item.name, items })
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
              <dd className="ml-12 flex items-baseline pb-4">
                <p className="text-xl font-semibold text-gray-900 underline decoration-dotted">{item.value}</p>
                {compareToPrevious ? (
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
        <div className="mt-8 bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Location Overview
            </h3>
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
              <div className="space-y-4">
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
                      className="border rounded-lg p-4 hover:border-indigo-300 transition-colors"
                    >
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
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
                          <div className="flex justify-between items-center mb-2">
                            <div className="text-xs font-medium text-gray-700">SLA</div>
                            {slaData && (
                              <div className="text-[11px] text-gray-600">
                                <span className="font-semibold">{slaData.total}</span> positions
                              </div>
                            )}
                          </div>
                          {slaData ? (
                            <div className="space-y-1.5">
                              {Object.entries(slaData.buckets).map(
                                ([bucket, count]: [string, any]) => (
                                  <div key={bucket} className="flex items-center">
                                    <div className="w-28 text-[10px] text-gray-600 truncate mr-2">
                                      {bucket}
                                    </div>
                                    <button
                                      className="flex-1 bg-gray-200 rounded-full h-1.5 group"
                                      onClick={() => {
                                        const bucketMatch = (position: any) => {
                                          const nowDate = new Date()
                                          const dateValue =
                                            position?.fptkReceiveDate || position?.requestDate
                                          if (!dateValue) return false
                                          const d = new Date(dateValue)
                                          if (isNaN(d.getTime())) return false
                                          const diffDays = businessDaysDiffIndonesia(d, nowDate)
                                          if (bucket === '0-30 Days') return diffDays <= 30
                                          if (bucket === '31-60 Days')
                                            return diffDays > 30 && diffDays <= 60
                                          if (bucket === '61-90 Days')
                                            return diffDays > 60 && diffDays <= 90
                                          return diffDays > 90
                                        }
                                        const items = filteredPositions
                                          .filter(
                                            (j: any) =>
                                              (j.areaDetail || j.area || j.location || 'Unknown') ===
                                              slaData.areaDetail
                                          )
                                          .filter((j: any) => bucketMatch(j))
                                          .map((j: any) => ({
                                            id: j.id,
                                            kind: 'fptk',
                                            title: j.title || j.position || 'Unknown Position',
                                            subtitle: `${j.department || 'N/A'} • ${j.location || 'N/A'}`,
                                            meta: `FPTK Received: ${
                                              j.fptkReceiveDate || j.requestDate
                                                ? new Date(
                                                    j.fptkReceiveDate || j.requestDate
                                                  ).toLocaleDateString()
                                                : '-'
                                            }`,
                                          }))
                                        setDetailModal({
                                          title: `${bucket} • ${slaData.areaDetail}`,
                                          items,
                                        })
                                      }}
                                      title={`${bucket}: ${count} positions`}
                                    >
                                      <div
                                        className="bg-purple-500 h-1.5 rounded-full transition-all duration-300 group-hover:bg-purple-600"
                                        style={{
                                          width: `${
                                            slaData.total > 0
                                              ? (count / slaData.total) * 100
                                              : 0
                                          }%`,
                                        }}
                                      ></div>
                                    </button>
                                    <button
                                      className="w-6 text-[10px] text-gray-600 text-right ml-2 hover:underline"
                                      onClick={() => {
                                        const bucketMatch = (position: any) => {
                                          const nowDate = new Date()
                                          const dateValue =
                                            position?.fptkReceiveDate || position?.requestDate
                                          if (!dateValue) return false
                                          const d = new Date(dateValue)
                                          if (isNaN(d.getTime())) return false
                                          const diffDays = businessDaysDiffIndonesia(d, nowDate)
                                          if (bucket === '0-30 Days') return diffDays <= 30
                                          if (bucket === '31-60 Days')
                                            return diffDays > 30 && diffDays <= 60
                                          if (bucket === '61-90 Days')
                                            return diffDays > 60 && diffDays <= 90
                                          return diffDays > 90
                                        }
                                        const items = filteredPositions
                                          .filter(
                                            (j: any) =>
                                              (j.areaDetail || j.area || j.location || 'Unknown') ===
                                              slaData.areaDetail
                                          )
                                          .filter((j: any) => bucketMatch(j))
                                          .map((j: any) => ({
                                            id: j.id,
                                            kind: 'fptk',
                                            title: j.title || j.position || 'Unknown Position',
                                            subtitle: `${j.department || 'N/A'} • ${j.location || 'N/A'}`,
                                            meta: `FPTK Received: ${
                                              j.fptkReceiveDate || j.requestDate
                                                ? new Date(
                                                    j.fptkReceiveDate || j.requestDate
                                                  ).toLocaleDateString()
                                                : '-'
                                            }`,
                                          }))
                                        setDetailModal({
                                          title: `${bucket} • ${slaData.areaDetail}`,
                                          items,
                                        })
                                      }}
                                    >
                                      {count}
                                    </button>
                                  </div>
                                )
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
        <div className="mt-8">
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Quick Actions
              </h3>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
        <div className="mt-8">
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Recent Activity
              </h3>
              <div className="mt-5">
                {dashboardStats.recentActivity.length > 0 ? (
                  <div className="flow-root">
                    <ul className="-mb-8">
                      {dashboardStats.recentActivity.map((activity, activityIdx) => (
                        <li key={activityIdx}>
                          <div className="relative pb-8">
                            {activityIdx !== dashboardStats.recentActivity.length - 1 ? (
                              <span
                                className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                                aria-hidden="true"
                              />
                            ) : null}
                            <div className="relative flex space-x-3">
                              <div>
                                <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                                  activity.icon === 'user' ? 'bg-indigo-500' : 'bg-green-500'
                                }`}>
                                  {activity.icon === 'user' ? (
                                    <UsersIcon className="h-5 w-5 text-white" />
                                  ) : (
                                    <BriefcaseIcon className="h-5 w-5 text-white" />
                                  )}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
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
            <div className="max-h-[60vh] overflow-auto px-6 py-4">
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
                        if (it.kind === 'fptk') return openFptkEdit(it.id, detailModal?.title || 'Dashboard')
                        if (it.kind === 'candidate') return openCandidateView(it.id)
                      }
                      return (
                        <li key={it.id || idx} className="py-3">
                          {clickable ? (
                            <button className="w-full text-left" onClick={onClick}>
                              <div className="text-sm font-medium text-indigo-700 hover:underline">{it.title}</div>
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
    </Layout>
  )
}