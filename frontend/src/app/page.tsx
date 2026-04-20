'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout/Layout'
import {
  UsersIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { DashboardStats, PositionStatusByLocation, OpenPositionProgress, SLALocation } from '@/types'
import { DashboardAPI, CandidatesAPI, FPTKAPI, ApplicationsAPI } from '@/lib/api'
import { mapApiFptk } from './fptk/page'
import { businessDaysDiffIndonesia } from '@/utils/indoBusinessDays'
import {
  getRollingWeekWindowBounds,
  isTimestampInRange,
  parseTimestamp,
  weekOverWeekFromDataset,
} from '@/utils/weekOverWeek'

const PRIORITY_FILTERS = ['ALL', 'P0', 'P1', 'P2'] as const

const normalizeUiCurrentStatus = (value?: string) => (value || '').trim().toLowerCase()

/** Open Positions card: Open | Pending FKTK | Re-Open */
const isOpenCurrentStatusLabel = (value?: string) => {
  const s = normalizeUiCurrentStatus(value)
  if (!s) return true
  return s === 'open' || s === 'pending fktk' || s === 're-open' || s === 'reopen'
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

const getMonthRange = () => {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  const endOfMonth = new Date(startOfMonth)
  endOfMonth.setMonth(endOfMonth.getMonth() + 1)
  endOfMonth.setMilliseconds(endOfMonth.getMilliseconds() - 1)
  return { startOfMonth, endOfMonth }
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

const getInterviewsThisWeekItems = (positions: any[]): DashboardListItem[] => {
  const { startOfWeek, endOfWeek } = getCurrentWeekRange()
  const items: DashboardListItem[] = []

  const statusMatches = (raw: string) => {
    const s = (raw || '').trim().toLowerCase()
    return s === 'interview scheduled' || s === 'interviewed'
  }

  positions.forEach((position) => {
    (position?.appliedCandidates || []).forEach((candidate: any) => {
      if (!statusMatches(candidate?.status || '')) return
      ;(candidate?.interviews || []).forEach((interview: any) => {
        const date = parseDateValue(interview?.date || interview?.scheduledAt)
        if (!date) return
        if (isWithinRange(date, startOfWeek, endOfWeek)) {
          const subtitleParts = [position?.title || position?.position || 'Unknown Position']
          if (position?.department) {
            subtitleParts.push(position.department)
          }
          items.push({
            id: position?.id,
            kind: position?.id ? ('fptk' as const) : undefined,
            title: candidate?.fullName || candidate?.name || 'Unknown Candidate',
            subtitle: subtitleParts.filter(Boolean).join(' • '),
            meta: `${date.toLocaleDateString()}${interview?.time ? ` at ${interview.time}` : ''}`,
          })
        }
      })
    })
  })

  return items
}

const getHiredThisMonthItems = (positions: any[]): DashboardListItem[] => {
  const { startOfMonth, endOfMonth } = getMonthRange()
  return positions
    .filter((position) => {
      const s = normalizeUiCurrentStatus(position?.currentStatus || position?.status)
      if (s !== 'close') return false
      const date = parseDateValue(position?.updatedAt)
      return date ? isWithinRange(date, startOfMonth, endOfMonth) : false
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

const countInterviewsInDateRange = (applications: any[], start: Date, end: Date): number => {
  let n = 0
  for (const application of applications) {
    const appStatus = (application?.status || '').toString().toUpperCase()
    if (appStatus !== 'INTERVIEW_SCHEDULED' && appStatus !== 'INTERVIEW_COMPLETED') continue
    for (const interview of application?.interviews || []) {
      if (!interview?.scheduledAt) continue
      const d = parseTimestamp(interview.scheduledAt)
      if (d && isTimestampInRange(d, start, end)) n += 1
    }
  }
  return n
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
  const [totalCandidatesModal, setTotalCandidatesModal] = useState<{
    page: number
    totalPages: number
    total: number
    items: DashboardListItem[]
    loading: boolean
  } | null>(null)
  const [totalCandidatesQuery, setTotalCandidatesQuery] = useState('')

const filteredPositions = useMemo(
  () => filterPositionsByPriority(allPositions, priorityFilter),
  [allPositions, priorityFilter]
)
const openPositionItems = useMemo<DashboardListItem[]>(() => {
  return filteredPositions
    .filter((position) => isOpenCurrentStatusLabel(position?.currentStatus || position?.status))
    .map((position) => ({
      id: position?.id,
      kind: 'fptk' as const,
      title: position?.title || position?.position || 'Unknown Position',
      subtitle: `${position?.department || 'N/A'} • ${position?.location || 'N/A'}`,
      meta: position?.currentStatus || position?.status || 'N/A',
    }))
}, [filteredPositions])

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
const interviewsThisWeekItems = useMemo(
  () => getInterviewsThisWeekItems(filteredPositions),
  [filteredPositions]
)
const hiredThisMonthItems = useMemo(
  () => getHiredThisMonthItems(filteredPositions),
  [filteredPositions]
)

  const applicationsScoped = useMemo(() => {
    if (!dashboardApplications.length) return []
    if (!fptkListHydrated) return dashboardApplications
    const idSet = new Set(filteredPositions.map((p: any) => p?.id).filter(Boolean))
    if (idSet.size === 0) return []
    return dashboardApplications.filter((a: any) => a.fptkId && idSet.has(a.fptkId))
  }, [dashboardApplications, filteredPositions, fptkListHydrated])

  const candidateCreatedRows = useMemo(() => {
    const rows: { createdAt?: string | null }[] = []
    const seen = new Set<string>()
    for (const a of applicationsScoped) {
      const id = a.candidate?.id || a.candidateId
      if (!id || seen.has(id)) continue
      seen.add(id)
      rows.push({ createdAt: a.candidate?.createdAt })
    }
    return rows
  }, [applicationsScoped])

  const interviewTimestampRows = useMemo(() => {
    const rows: { at: string }[] = []
    for (const application of applicationsScoped) {
      const appStatus = (application?.status || '').toString().toUpperCase()
      if (appStatus !== 'INTERVIEW_SCHEDULED' && appStatus !== 'INTERVIEW_COMPLETED') continue
      for (const interview of application?.interviews || []) {
        if (interview?.scheduledAt) rows.push({ at: interview.scheduledAt })
      }
    }
    return rows
  }, [applicationsScoped])

  const wowTotalCandidates = useMemo(
    () => weekOverWeekFromDataset(candidateCreatedRows, (r) => r.createdAt),
    [candidateCreatedRows]
  )

  const wowOpenPositions = useMemo(
    () =>
      weekOverWeekFromDataset(filteredPositions, (p) => p.createdAt, {
        predicate: (p) => isOpenCurrentStatusLabel(p?.currentStatus || p?.status),
      }),
    [filteredPositions]
  )

  const wowClosedPositions = useMemo(
    () =>
      weekOverWeekFromDataset(filteredPositions, (p) => p.createdAt, {
        predicate: (p) => isClosedCurrentStatusLabel(p?.currentStatus || p?.status),
      }),
    [filteredPositions]
  )

  const wowHoldPositions = useMemo(
    () =>
      weekOverWeekFromDataset(filteredPositions, (p) => p.createdAt, {
        predicate: (p) => isHoldCurrentStatusLabel(p?.currentStatus || p?.status),
      }),
    [filteredPositions]
  )

  const wowInterviews = useMemo(
    () => weekOverWeekFromDataset(interviewTimestampRows, (r) => r.at),
    [interviewTimestampRows]
  )

  const wowHiredRolling = useMemo(
    () =>
      weekOverWeekFromDataset(filteredPositions, (p) => p.updatedAt, {
        predicate: (p) => isClosedCurrentStatusLabel(p?.currentStatus || p?.status),
      }),
    [filteredPositions]
  )

  const totalCandidatesHeadline = useMemo(() => {
    if (priorityFilter !== 'ALL') return candidateCreatedRows.length
    if (baseStats?.totalCandidates != null) return baseStats.totalCandidates
    return candidateCreatedRows.length
  }, [priorityFilter, baseStats?.totalCandidates, candidateCreatedRows.length])

  const openPositionsHeadline = useMemo(() => {
    if (fptkListHydrated) return openPositionItems.length
    return baseStats?.openPositions ?? openPositionItems.length
  }, [fptkListHydrated, openPositionItems.length, baseStats?.openPositions])

  const closedPositionsHeadline = useMemo(() => {
    if (fptkListHydrated) return closedPositionItems.length
    return baseStats?.closedPositions ?? closedPositionItems.length
  }, [fptkListHydrated, closedPositionItems.length, baseStats?.closedPositions])

  const holdPositionsHeadline = useMemo(() => {
    if (fptkListHydrated) return holdPositionItems.length
    return baseStats?.holdPositions ?? holdPositionItems.length
  }, [fptkListHydrated, holdPositionItems.length, baseStats?.holdPositions])

  const interviewsHeadline = useMemo(() => {
    if (dashboardApplications.length > 0) {
      const { currentStart, currentEnd } = getRollingWeekWindowBounds()
      return countInterviewsInDateRange(applicationsScoped, currentStart, currentEnd)
    }
    return (
      interviewDetailItems.length ||
      interviewsThisWeekItems.length ||
      baseStats?.interviewsThisWeek ||
      0
    )
  }, [
    dashboardApplications.length,
    applicationsScoped,
    interviewDetailItems.length,
    interviewsThisWeekItems.length,
    baseStats?.interviewsThisWeek,
  ])

  const hiredThisMonthHeadline = useMemo(
    () => hiredThisMonthItems.length || baseStats?.hiredThisMonth || 0,
    [hiredThisMonthItems.length, baseStats?.hiredThisMonth]
  )

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
        value: totalCandidatesHeadline.toString(),
        icon: UsersIcon,
        change: wowTotalCandidates.formattedChange,
        changeType: wowTotalCandidates.sentiment,
      },
      {
        name: 'Open Positions',
        value: openPositionsHeadline.toString(),
        icon: BriefcaseIcon,
        change: wowOpenPositions.formattedChange,
        changeType: wowOpenPositions.sentiment,
      },
      {
        name: 'Closed Positions',
        value: closedPositionsHeadline.toString(),
        icon: BriefcaseIcon,
        change: wowClosedPositions.formattedChange,
        changeType: wowClosedPositions.sentiment,
      },
      {
        name: 'Hold Positions',
        value: holdPositionsHeadline.toString(),
        icon: BriefcaseIcon,
        change: wowHoldPositions.formattedChange,
        changeType: wowHoldPositions.sentiment,
      },
      {
        name: 'Interviews This Week',
        value: interviewsHeadline.toString(),
        icon: CalendarDaysIcon,
        change: wowInterviews.formattedChange,
        changeType: wowInterviews.sentiment,
      },
      {
        name: 'Hired This Month',
        value: hiredThisMonthHeadline.toString(),
        icon: DocumentTextIcon,
        change: wowHiredRolling.formattedChange,
        changeType: wowHiredRolling.sentiment,
      },
    ],
    [
      totalCandidatesHeadline,
      wowTotalCandidates,
      openPositionsHeadline,
      wowOpenPositions,
      closedPositionsHeadline,
      wowClosedPositions,
      holdPositionsHeadline,
      wowHoldPositions,
      interviewsHeadline,
      wowInterviews,
      hiredThisMonthHeadline,
      wowHiredRolling,
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
    totalCandidates: totalCandidatesHeadline,
    activeApplications: baseStats.activeApplications ?? 0,
    openPositions: openPositionsHeadline,
    closedPositions: closedPositionsHeadline,
    holdPositions: holdPositionsHeadline,
    interviewsThisWeek: interviewsHeadline,
    hiredThisMonth: hiredThisMonthHeadline,
    recentActivity: baseStats.recentActivity ?? [],
    positionStatusByLocation: (baseStats as any).positionStatusByLocation || computePositionStatusByLocation(filteredPositions),
    openPositionProgress: (baseStats as any).openPositionProgress || computeOpenPositionProgress(filteredPositions),
    slaByLocation: (baseStats as any).slaByLocation || computeSlaByLocation(filteredPositions),
  })
}, [
  baseStats,
  filteredPositions,
  totalCandidatesHeadline,
  openPositionsHeadline,
  closedPositionsHeadline,
  holdPositionsHeadline,
  interviewsHeadline,
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

  const openFptkEdit = (id?: string) => {
    if (!id) return
    setDetailModal(null)
    setOpenPositionsModalOpen(false)
    setTotalCandidatesModal(null)
    setTotalCandidatesQuery('')
    router.push(`/fptk?edit=${encodeURIComponent(id)}`)
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

        {/* Priority Filter */}
        <div className="mb-6">
          <span className="text-sm font-medium text-gray-700 mr-4">Priority Filter:</span>
          <div className="inline-flex rounded-md shadow-sm">
            {PRIORITY_FILTERS.map((filter, index) => (
              <button
                key={filter}
                onClick={() => setPriorityFilter(filter)}
                className={`px-4 py-2 border text-sm font-medium ${
                  filter === priorityFilter
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                } ${index === 0 ? 'rounded-l-md' : ''} ${
                  index === PRIORITY_FILTERS.length - 1 ? 'rounded-r-md' : ''
                }`}
              >
                {filter === 'ALL' ? 'All' : filter}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((item) => (
            <button
              key={item.name}
              className="text-left relative overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:px-6 sm:py-6 hover:ring-2 hover:ring-indigo-500 focus:outline-none"
              onClick={async () => {
                if (item.name === 'Open Positions') {
                  setOpenPositionsModalOpen(true)
                  if (!openPositionsLoadedOnceRef.current) {
                    await fetchOpenPositions('')
                  }
                  return
                }
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

                  if (item.name === 'Closed Positions') {
                    const pos = await fetchAllFptksForDashboard()
                    setAllPositions(pos)
                    items = filterPositionsByPriority(pos, priorityFilter)
                      .filter((p: any) => isClosedCurrentStatusLabel(p?.currentStatus || p?.status))
                      .map(mapPositionRow)
                  } else if (item.name === 'Hold Positions') {
                    const pos = await fetchAllFptksForDashboard()
                    setAllPositions(pos)
                    items = filterPositionsByPriority(pos, priorityFilter)
                      .filter((p: any) => isHoldCurrentStatusLabel(p?.currentStatus || p?.status))
                      .map(mapPositionRow)
                  } else if (item.name === 'Interviews This Week') {
                    const pos = await fetchAllFptksForDashboard()
                    setAllPositions(pos)
                    const local = getInterviewsThisWeekItems(filterPositionsByPriority(pos, priorityFilter))
                    if (local.length > 0) {
                      items = local
                    } else {
                      const fromApi = await loadApplicationInsights()
                      items = fromApi.length ? fromApi : local
                    }
                  } else if (item.name === 'Hired This Month') {
                    const pos = await fetchAllFptksForDashboard()
                    setAllPositions(pos)
                    items = getHiredThisMonthItems(filterPositionsByPriority(pos, priorityFilter))
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
                <div className="absolute rounded-md bg-indigo-500 p-3">
                  <item.icon className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                <p className="ml-16 truncate text-sm font-medium text-gray-500">
                  {item.name}
                </p>
              </dt>
              <dd className="ml-16 flex items-baseline pb-6 sm:pb-7">
                <p className="text-2xl font-semibold text-gray-900 underline decoration-dotted">{item.value}</p>
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
              </dd>
            </button>
          ))}
        </div>

        {openPositionsModalOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
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
                  ) : openPositionsList.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500">No open positions found.</div>
                  ) : (
                    <ul className="divide-y">
                      {openPositionsList.map((p: any) => {
                        const title = p?.title || p?.position || 'Unknown Position'
                        const sub = `${p?.department || 'N/A'} • ${p?.location || 'N/A'}`
                        const meta = p?.currentStatus || p?.status || 'N/A'
                        return (
                          <li key={p.id} className="px-4 py-3 hover:bg-gray-50">
                            <button
                              className="w-full text-left"
                              onClick={() => {
                                openFptkEdit(p.id)
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

              <div className="px-6 py-4 border-t flex justify-end">
                <button
                  className="px-4 py-2 text-sm rounded-md border text-gray-700 bg-white hover:bg-gray-50"
                  onClick={() => setOpenPositionsModalOpen(false)}
                >
                  Close
                </button>
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
            <div className="hidden lg:grid grid-cols-4 gap-4 text-xs font-semibold text-gray-500 border-b pb-2 mb-4">
              <span>Location</span>
              <span>Position Status by Location</span>
              <span>Open Position Progress by Area Detail</span>
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
                      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
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
                              <div className="flex space-x-3 text-[11px] text-gray-600">
                                <button
                                  className="hover:underline"
                                  onClick={() => {
                                    const items = filteredPositions
                                      .filter(
                                        (j: any) =>
                                          (j.areaDetail || j.area || j.location || 'Unknown') ===
                                          statusData.location
                                      )
                                      .map((j: any) => ({
                                        id: j.id,
                                        kind: 'fptk',
                                        title: j.title || j.position || 'Unknown Position',
                                        subtitle: `${j.department || 'N/A'} • ${j.location || 'N/A'}`,
                                        meta: j.currentStatus || j.status || 'N/A',
                                      }))
                                    setDetailModal({
                                      title: `Total Positions • ${statusData.location}`,
                                      items,
                                    })
                                  }}
                                >
                                  Total:{' '}
                                  <span className="font-semibold">{statusData.total}</span>
                                </button>
                                <button
                                  className="text-green-600 hover:underline"
                                  onClick={() => {
                                    const items = filteredPositions
                                      .filter(
                                        (j: any) =>
                                          (j.areaDetail || j.area || j.location || 'Unknown') ===
                                          statusData.location
                                      )
                                      .filter((j: any) =>
                                        isOpenCurrentStatusLabel(j.currentStatus || j.status)
                                      )
                                      .map((j: any) => ({
                                        id: j.id,
                                        kind: 'fptk',
                                        title: j.title || j.position || 'Unknown Position',
                                        subtitle: `${j.department || 'N/A'} • ${j.location || 'N/A'}`,
                                        meta: j.currentStatus || j.status || 'N/A',
                                      }))
                                    setDetailModal({
                                      title: `Open Positions • ${statusData.location}`,
                                      items,
                                    })
                                  }}
                                >
                                  Open:{' '}
                                  <span className="font-semibold">{statusData.open}</span>
                                </button>
                                <button
                                  className="text-red-600 hover:underline"
                                  onClick={() => {
                                    const items = filteredPositions
                                      .filter(
                                        (j: any) =>
                                          (j.areaDetail || j.area || j.location || 'Unknown') ===
                                          statusData.location
                                      )
                                      .filter((j: any) => {
                                        const cs = j.currentStatus || j.status || ''
                                        const n = normalizeUiCurrentStatus(cs)
                                        return (
                                          isClosedCurrentStatusLabel(cs) ||
                                          n === 'cancel' ||
                                          n === 'cancelled'
                                        )
                                      })
                                      .map((j: any) => ({
                                        id: j.id,
                                        kind: 'fptk',
                                        title: j.title || j.position || 'Unknown Position',
                                        subtitle: `${j.department || 'N/A'} • ${j.location || 'N/A'}`,
                                        meta: j.currentStatus || j.status || 'N/A',
                                      }))
                                    setDetailModal({
                                      title: `Closed Positions • ${statusData.location}`,
                                      items,
                                    })
                                  }}
                                >
                                  Closed:{' '}
                                  <span className="font-semibold">{statusData.closed}</span>
                                </button>
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

                        {/* Open Position Progress */}
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex justify-between items-center mb-2">
                            <div className="text-xs font-medium text-gray-700">Open Progress</div>
                            {progressData && (
                              <div className="text-[11px] text-gray-600">
                                <span className="font-semibold">{progressData.total}</span> positions (
                                {progressData.percentage}%)
                              </div>
                            )}
                          </div>
                          {progressData ? (
                            <div className="space-y-1.5">
                              {Object.entries(progressData.statusCounts).map(
                                ([status, count]: [string, any]) => (
                                  <div key={status} className="flex items-center">
                                    <div className="w-24 text-[10px] text-gray-600 truncate mr-2">
                                      {status}
                                    </div>
                                    <button
                                      className="flex-1 bg-gray-200 rounded-full h-1.5 group"
                                      onClick={() => {
                                        const items = filteredPositions
                                          .filter(
                                            (j: any) =>
                                              (j.areaDetail || j.area || j.location || 'Unknown') ===
                                              progressData.areaDetail
                                          )
                                          .filter(
                                            (j: any) =>
                                              (j.currentStatus || j.status || 'Raise FPTK') === status
                                          )
                                          .map((j: any) => ({
                                            id: j.id,
                                            kind: 'fptk',
                                            title: j.title || j.position || 'Unknown Position',
                                            subtitle: `${j.department || 'N/A'} • ${j.location || 'N/A'}`,
                                            meta: j.currentStatus || j.status || 'N/A',
                                          }))
                                        setDetailModal({
                                          title: `${status} • ${progressData.areaDetail}`,
                                          items,
                                        })
                                      }}
                                      title={`${status}: ${count} positions`}
                                    >
                                      <div
                                        className="bg-blue-500 h-1.5 rounded-full transition-all duration-300 group-hover:bg-blue-600"
                                        style={{
                                          width: `${(count / progressData.total) * 100}%`,
                                        }}
                                      ></div>
                                    </button>
                                    <button
                                      className="w-6 text-[10px] text-gray-600 text-right ml-2 hover:underline"
                                      onClick={() => {
                                        const items = filteredPositions
                                          .filter(
                                            (j: any) =>
                                              (j.areaDetail || j.area || j.location || 'Unknown') ===
                                              progressData.areaDetail
                                          )
                                          .filter(
                                            (j: any) =>
                                              (j.currentStatus || j.status || 'Raise FPTK') === status
                                          )
                                          .map((j: any) => ({
                                            id: j.id,
                                            kind: 'fptk',
                                            title: j.title || j.position || 'Unknown Position',
                                            subtitle: `${j.department || 'N/A'} • ${j.location || 'N/A'}`,
                                            meta: j.currentStatus || j.status || 'N/A',
                                          }))
                                        setDetailModal({
                                          title: `${status} • ${progressData.areaDetail}`,
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
                            <div className="text-xs text-gray-400">No progress data.</div>
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
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
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
                  {detailModal.items
                    .filter((it: DashboardListItem) => matchesQuery(it, detailQuery))
                    .map((it: DashboardListItem, idx: number) => {
                      const clickable = !!it.id && (it.kind === 'fptk' || it.kind === 'candidate')
                      const onClick = () => {
                        if (it.kind === 'fptk') return openFptkEdit(it.id)
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
      )}
    </Layout>
  )
}