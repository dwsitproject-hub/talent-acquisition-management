'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout/Layout'
import {
  UsersIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  ChartBarIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { DashboardStats, PositionStatusByLocation, OpenPositionProgress, SLALocation } from '@/types'
import { DashboardAPI, CandidatesAPI, FPTKAPI, ApplicationsAPI } from '@/lib/api'
import { mapApiFptk } from './fptk/page'

const PRIORITY_FILTERS = ['ALL', 'P0', 'P1', 'P2'] as const
const PENDING_OFFER_STATUSES = ['PENDING_HRBP_REVIEW', 'PENDING_HEAD_APPROVAL', 'SENT_TO_CANDIDATE']

type DashboardListItem = {
  title: string
  subtitle?: string
  meta?: string
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
    const status = (position?.currentStatus || position?.status || '').toLowerCase()
    if (status === 'on boarding' || status === 'cancelled') {
      acc[location].closed += 1
    } else {
      acc[location].open += 1
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

    const diffDays = Math.floor((now.getTime() - receivedDate.getTime()) / (1000 * 60 * 60 * 24))
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

  positions.forEach((position) => {
    (position?.appliedCandidates || []).forEach((candidate: any) => {
      ;(candidate?.interviews || []).forEach((interview: any) => {
        const date = parseDateValue(interview?.date || interview?.scheduledAt)
        if (!date) return
        if (isWithinRange(date, startOfWeek, endOfWeek)) {
          const subtitleParts = [position?.title || position?.position || 'Unknown Position']
          if (position?.department) {
            subtitleParts.push(position.department)
          }
          items.push({
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
      const status = (position?.currentStatus || position?.status || '').toLowerCase()
      if (status !== 'signing') return false
      const date = parseDateValue(position?.updatedAt)
      return date ? isWithinRange(date, startOfMonth, endOfMonth) : false
    })
    .map((position) => {
      const date = parseDateValue(position?.updatedAt)
      return {
        title: position?.title || position?.position || 'Unknown Position',
        subtitle: position?.department ? `${position.department} • ${position.location || 'N/A'}` : position?.location,
        meta: date ? `Signed on ${date.toLocaleDateString()}` : undefined,
      }
    })
}

const getPendingOfferItems = (positions: any[]): DashboardListItem[] =>
  positions
    .filter(
      (position) => (position?.currentStatus || position?.status || '').toLowerCase() === 'offering process'
    )
    .map((position) => ({
      title: position?.title || position?.position || 'Unknown Position',
      subtitle: position?.department ? `${position.department} • ${position.location || 'N/A'}` : position?.location,
      meta: 'Awaiting offer confirmation',
    }))

const buildApplicationInsights = (
  applications: any[],
  weekRange: { startOfWeek: Date; endOfWeek: Date },
  monthRange: { startOfMonth: Date; endOfMonth: Date }
) => {
  const interviewItems: DashboardListItem[] = []
  const hiredItems: DashboardListItem[] = []
  const pendingItems: DashboardListItem[] = []

  applications.forEach((application: any) => {
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
          title: candidateName,
          subtitle: `${positionTitle} • ${application?.fptk?.department || 'N/A'}`,
          meta: metaParts.join(' • '),
        })
      }
    })

    if ((application?.status || '').toString().toUpperCase() === 'HIRED') {
      const hiredDate = application?.hiredAt ? new Date(application.hiredAt) : application?.updatedAt ? new Date(application.updatedAt) : null
      if (hiredDate && !isNaN(hiredDate.getTime()) && isWithinRange(hiredDate, monthRange.startOfMonth, monthRange.endOfMonth)) {
        hiredItems.push({
          title: candidateName,
          subtitle: `${positionTitle} • ${application?.fptk?.department || 'N/A'}`,
          meta: `Hired on ${hiredDate.toLocaleDateString()}`,
        })
      }
    }

    const pendingOffer = (application?.offers || []).find((offer: any) =>
      PENDING_OFFER_STATUSES.includes((offer?.status || '').toString().toUpperCase())
    )

    if (pendingOffer) {
      const offerStatus = pendingOffer.status
      pendingItems.push({
        title: candidateName,
        subtitle: `${positionTitle} • ${application?.fptk?.department || 'N/A'}`,
        meta: `Offer Status: ${offerStatus ? offerStatus.replace(/_/g, ' ') : 'Pending'}`,
      })
    }
  })

  return { interviewItems, hiredItems, pendingItems }
}

export default function Dashboard() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalCandidates: 0,
    activeApplications: 0,
    openPositions: 0,
    interviewsThisWeek: 0,
    hiredThisMonth: 0,
    pendingOffers: 0,
    recentActivity: [] as any[],
    positionStatusByLocation: [],
    openPositionProgress: [],
    slaByLocation: []
  })
  const [detailModal, setDetailModal] = useState<{ title: string, items: any[] } | null>(null)
  const [baseStats, setBaseStats] = useState<Partial<DashboardStats> | null>(null)
  const [allPositions, setAllPositions] = useState<any[]>([])
  const [priorityFilter, setPriorityFilter] = useState<typeof PRIORITY_FILTERS[number]>('ALL')
  const [interviewDetailItems, setInterviewDetailItems] = useState<DashboardListItem[]>([])
  const [hiredDetailItems, setHiredDetailItems] = useState<DashboardListItem[]>([])
  const [pendingOfferDetailItems, setPendingOfferDetailItems] = useState<DashboardListItem[]>([])
  const [isLoadingApplicationInsights, setIsLoadingApplicationInsights] = useState(false)
  const [applicationInsightsLoaded, setApplicationInsightsLoaded] = useState(false)

const filteredPositions = useMemo(
  () => filterPositionsByPriority(allPositions, priorityFilter),
  [allPositions, priorityFilter]
)
const openPositionItems = useMemo(() => {
  return filteredPositions
    .filter((position) => {
      const status = (position?.currentStatus || position?.status || '').toLowerCase()
      return status !== 'on boarding' && status !== 'cancelled'
    })
    .map((position) => ({
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
const pendingOfferItems = useMemo(
  () => getPendingOfferItems(filteredPositions),
  [filteredPositions]
)

  const stats = [
    {
      name: 'Total Candidates',
      value: dashboardStats.totalCandidates.toString(),
      icon: UsersIcon,
      change: '+12%',
      changeType: 'positive',
    },
    {
      name: 'Open Positions',
      value: dashboardStats.openPositions.toString(),
      icon: BriefcaseIcon,
      change: '+3%',
      changeType: 'positive',
    },
    {
      name: 'Interviews This Week',
      value: dashboardStats.interviewsThisWeek.toString(),
      icon: CalendarDaysIcon,
      change: '-2%',
      changeType: 'negative',
    },
    {
      name: 'Hired This Month',
      value: dashboardStats.hiredThisMonth.toString(),
      icon: DocumentTextIcon,
      change: '+15%',
      changeType: 'positive',
    },
    {
      name: 'Pending Offers',
      value: dashboardStats.pendingOffers.toString(),
      icon: ChartBarIcon,
      change: '+5%',
      changeType: 'positive',
    },
  ]

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    } else if (isAuthenticated) {
      loadDashboardData()
    }
  }, [isAuthenticated, isLoading, router])

  useEffect(() => {
    if (!isLoading && isAuthenticated && !applicationInsightsLoaded) {
      loadApplicationInsights()
    }
  }, [isLoading, isAuthenticated, applicationInsightsLoaded])

useEffect(() => {
  if (!baseStats) return

  const interviewsCount = interviewDetailItems.length || interviewsThisWeekItems.length
  const hiredCount = hiredDetailItems.length || hiredThisMonthItems.length
  const pendingCount = pendingOfferDetailItems.length || pendingOfferItems.length

  setDashboardStats({
    totalCandidates: baseStats.totalCandidates ?? 0,
    activeApplications: baseStats.activeApplications ?? 0,
    openPositions: openPositionItems.length,
    interviewsThisWeek: interviewsCount,
    hiredThisMonth: hiredCount,
    pendingOffers: pendingCount,
    recentActivity: baseStats.recentActivity ?? [],
    positionStatusByLocation: computePositionStatusByLocation(filteredPositions),
    openPositionProgress: computeOpenPositionProgress(filteredPositions),
    slaByLocation: computeSlaByLocation(filteredPositions),
  })
}, [
  baseStats,
  filteredPositions,
  openPositionItems.length,
  interviewsThisWeekItems.length,
  hiredThisMonthItems.length,
  pendingOfferItems.length,
  interviewDetailItems.length,
  hiredDetailItems.length,
  pendingOfferDetailItems.length,
])

  const fetchAllPositions = async (): Promise<any[]> => {
    if (!isAuthenticated) return []
    const limit = 100
    let page = 1
    let hasMore = true
    let positions: any[] = []

  while (hasMore) {
    const response = await FPTKAPI.getAll({}, { page, limit })
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

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('jobPostings', JSON.stringify(positions))
      } catch (error) {
        console.warn('Could not save positions to localStorage:', error)
      }
    }

    return positions
  }

  const loadApplicationInsights = async () => {
    if (isLoadingApplicationInsights || !isAuthenticated) return

    setIsLoadingApplicationInsights(true)

    try {
      const limit = 100
      let page = 1
      let hasMore = true
      const weekRange = getCurrentWeekRange()
      const monthRange = getMonthRange()
      const interviewItems: DashboardListItem[] = []
      const hiredItems: DashboardListItem[] = []
      const pendingItems: DashboardListItem[] = []

      while (hasMore) {
        const response = await ApplicationsAPI.getAll({}, { page, limit })
        const data = Array.isArray(response?.data) ? response.data : []

        if (data.length === 0) {
          break
        }

        const insights = buildApplicationInsights(data, weekRange, monthRange)
        interviewItems.push(...insights.interviewItems)
        hiredItems.push(...insights.hiredItems)
        pendingItems.push(...insights.pendingItems)

        const totalPages = response?.pagination?.totalPages
        if (totalPages) {
          hasMore = page < totalPages
        } else {
          hasMore = data.length === limit
        }
        page += 1
      }

      setInterviewDetailItems(interviewItems)
      setHiredDetailItems(hiredItems)
      setPendingOfferDetailItems(pendingItems)
      setApplicationInsightsLoaded(true)
    } catch (error) {
      console.error('Error loading application insights:', error)
    } finally {
      setIsLoadingApplicationInsights(false)
    }
  }

  const loadDashboardData = async () => {
    if (!isAuthenticated) return
    try {
      // Load dashboard stats from API
      const stats = await DashboardAPI.getStats()
      const positions = await fetchAllPositions()
      console.log('Dashboard API Response:', stats)
      console.log('Position Status by Location:', stats.positionStatusByLocation)
      console.log('Open Position Progress:', stats.openPositionProgress)
      console.log('SLA by Location:', stats.slaByLocation)
      
      // Fallback compute open positions if API returns zero
      let openPositionsComputed = stats.openPositions ?? 0
      if (!openPositionsComputed || openPositionsComputed === 0) {
        if (typeof window !== 'undefined') {
          try {
            const jobPostingsData = localStorage.getItem('jobPostings')
            const jobPostings = jobPostingsData ? JSON.parse(jobPostingsData) : []
            openPositionsComputed = jobPostings.filter((j: any) => j.status !== 'On Boarding' && j.status !== 'Cancelled').length
          } catch (error) {
            console.warn('Could not load positions from localStorage:', error)
          }
        }
      }

      const base = {
        totalCandidates: stats.totalCandidates || 0,
        activeApplications: stats.activeApplications || 0,
        recentActivity: stats.recentActivity || [],
      }

      setBaseStats({
        ...base,
        openPositions: openPositionsComputed || stats.activeFPTKs || stats.totalFPTKs || 0,
      })
      setAllPositions(positions)
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
      setAllPositions(jobPostings)
    }
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
                setDetailModal({ title: item.name, items: [] })
                try {
                  let items: DashboardListItem[] = []

                  if (item.name === 'Total Candidates') {
                    const response = await CandidatesAPI.getAll({}, { page: 1, limit: 100 })
                    const candidates = response.data || []
                    items = candidates.map((c: any) => ({
                      title: `${c.user?.firstName || ''} ${c.user?.lastName || ''}`.trim() || 'Unknown',
                      subtitle: c.user?.email || 'No email',
                      meta: c._count?.applications ? `${c._count.applications} application(s)` : 'No applications',
                    }))
                  } else if (item.name === 'Open Positions') {
                    items = openPositionItems
                  } else if (item.name === 'Interviews This Week') {
                    items = interviewDetailItems.length ? interviewDetailItems : interviewsThisWeekItems
                  } else if (item.name === 'Hired This Month') {
                    items = hiredDetailItems.length ? hiredDetailItems : hiredThisMonthItems
                  } else if (item.name === 'Pending Offers') {
                    items = pendingOfferDetailItems.length ? pendingOfferDetailItems : pendingOfferItems
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
                    item.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {item.change}
                </p>
              </dd>
            </button>
          ))}
        </div>

        {/* Charts Section */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Position Status by Location */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Position Status by Location
              </h3>
              <div className="mt-5">
                {dashboardStats.positionStatusByLocation.length > 0 ? (
                  <div className="space-y-6">
                    {dashboardStats.positionStatusByLocation.map((locationData: any, index: number) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="text-sm font-medium text-gray-900">{locationData.location}</h4>
                          <div className="flex space-x-4 text-sm text-gray-600">
                            <button
                              className="hover:underline"
                              onClick={() => {
                                const items = filteredPositions
                                  .filter(
                                    (j: any) =>
                                      (j.areaDetail || j.area || j.location || 'Unknown') === locationData.location
                                  )
                                  .map((j: any) => ({
                                    title: j.title || j.position || 'Unknown Position',
                                    subtitle: `${j.department || 'N/A'} • ${j.location || 'N/A'}`,
                                    meta: j.currentStatus || j.status || 'N/A',
                                  }))
                                setDetailModal({ title: `Total Positions • ${locationData.location}`, items })
                              }}
                            >
                              Total: <span className="font-semibold">{locationData.total}</span>
                            </button>
                            <button
                              className="text-green-600 hover:underline"
                              onClick={() => {
                                const items = filteredPositions
                                  .filter(
                                    (j: any) =>
                                      (j.areaDetail || j.area || j.location || 'Unknown') === locationData.location
                                  )
                                  .filter((j: any) => {
                                    const status = (j.currentStatus || j.status || '').toLowerCase()
                                    return status !== 'on boarding' && status !== 'cancelled'
                                  })
                                  .map((j: any) => ({
                                    title: j.title || j.position || 'Unknown Position',
                                    subtitle: `${j.department || 'N/A'} • ${j.location || 'N/A'}`,
                                    meta: j.currentStatus || j.status || 'N/A',
                                  }))
                                setDetailModal({ title: `Open Positions • ${locationData.location}`, items })
                              }}
                            >
                              Open: <span className="font-semibold">{locationData.open}</span>
                            </button>
                            <button
                              className="text-red-600 hover:underline"
                              onClick={() => {
                                const items = filteredPositions
                                  .filter(
                                    (j: any) =>
                                      (j.areaDetail || j.area || j.location || 'Unknown') === locationData.location
                                  )
                                  .filter((j: any) => {
                                    const status = (j.currentStatus || j.status || '').toLowerCase()
                                    return status === 'on boarding' || status === 'cancelled'
                                  })
                                  .map((j: any) => ({
                                    title: j.title || j.position || 'Unknown Position',
                                    subtitle: `${j.department || 'N/A'} • ${j.location || 'N/A'}`,
                                    meta: j.currentStatus || j.status || 'N/A',
                                  }))
                                setDetailModal({ title: `Closed Positions • ${locationData.location}`, items })
                              }}
                            >
                              Closed: <span className="font-semibold">{locationData.closed}</span>
                            </button>
                          </div>
                        </div>
                        
                        {/* Bar Chart */}
                        <div className="relative">
                          <div className="flex items-end space-x-1 h-8">
                            {/* Open Positions Bar */}
                            <div className="flex-1 flex flex-col items-center">
                              <div 
                                className="bg-green-500 rounded-t w-full transition-all duration-300 hover:bg-green-600"
                                style={{ 
                                  height: `${Math.max((locationData.open / locationData.total) * 100, 5)}%`,
                                  minHeight: locationData.open > 0 ? '8px' : '0px'
                                }}
                                title={`Open: ${locationData.open}`}
                              ></div>
                              <span className="text-xs text-gray-500 mt-1">Open</span>
                            </div>
                            
                            {/* Closed Positions Bar */}
                            <div className="flex-1 flex flex-col items-center">
                              <div 
                                className="bg-red-500 rounded-t w-full transition-all duration-300 hover:bg-red-600"
                                style={{ 
                                  height: `${Math.max((locationData.closed / locationData.total) * 100, 5)}%`,
                                  minHeight: locationData.closed > 0 ? '8px' : '0px'
                                }}
                                title={`Closed: ${locationData.closed}`}
                              ></div>
                              <span className="text-xs text-gray-500 mt-1">Closed</span>
                            </div>
                          </div>
                          
                          {/* Percentage Labels */}
                          <div className="flex justify-between mt-2 text-xs text-gray-500">
                            <span>{Math.round((locationData.open / locationData.total) * 100)}% Open</span>
                            <span>{Math.round((locationData.closed / locationData.total) * 100)}% Closed</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">
                    No position data available. Create some positions to see the chart.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Open Position Current Progress */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Open Position Progress by Area Detail
              </h3>
              <div className="mt-5">
                {dashboardStats.openPositionProgress.length > 0 ? (
                  <div className="space-y-6">
                    {dashboardStats.openPositionProgress.map((areaData: any, index: number) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="text-sm font-medium text-gray-900">{areaData.areaDetail}</h4>
                          <div className="text-sm text-gray-600">
                            <span className="font-semibold">{areaData.total}</span> total positions ({areaData.percentage}%)
                          </div>
                        </div>
                        
                        {/* Grouped Status Bars */}
                        <div className="space-y-2">
                          {Object.entries(areaData.statusCounts).map(([status, count]: [string, any]) => (
                            <div key={status} className="flex items-center">
                              <div className="w-24 text-xs text-gray-600 truncate mr-2">
                                {status}
                              </div>
                              <button
                                className="flex-1 bg-gray-200 rounded-full h-2 group"
                                onClick={() => {
                                  const items = filteredPositions
                                    .filter(
                                      (j: any) =>
                                        (j.areaDetail || j.area || j.location || 'Unknown') === areaData.areaDetail
                                    )
                                    .filter((j: any) => (j.currentStatus || j.status || 'Raise FPTK') === status)
                                    .map((j: any) => ({
                                      title: j.title || j.position || 'Unknown Position',
                                      subtitle: `${j.department || 'N/A'} • ${j.location || 'N/A'}`,
                                      meta: j.currentStatus || j.status || 'N/A',
                                    }))
                                  setDetailModal({ title: `${status} • ${areaData.areaDetail}`, items })
                                }}
                                title={`${status}: ${count} positions`}
                              >
                                <div 
                                  className="bg-blue-500 h-2 rounded-full transition-all duration-300 group-hover:bg-blue-600"
                                  style={{ width: `${(count / areaData.total) * 100}%` }}
                                ></div>
                              </button>
                              <button
                                className="w-8 text-xs text-gray-600 text-right ml-2 hover:underline"
                                onClick={() => {
                                  const items = filteredPositions
                                    .filter(
                                      (j: any) =>
                                        (j.areaDetail || j.area || j.location || 'Unknown') === areaData.areaDetail
                                    )
                                    .filter((j: any) => (j.currentStatus || j.status || 'Raise FPTK') === status)
                                    .map((j: any) => ({
                                      title: j.title || j.position || 'Unknown Position',
                                      subtitle: `${j.department || 'N/A'} • ${j.location || 'N/A'}`,
                                      meta: j.currentStatus || j.status || 'N/A',
                                    }))
                                  setDetailModal({ title: `${status} • ${areaData.areaDetail}`, items })
                                }}
                              >
                                {count}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">
                    No position progress data available. Create some positions to see the chart.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SLA by Location */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                SLA by Location (from FPTK Receive Date)
              </h3>
              <div className="mt-5">
                {dashboardStats.slaByLocation.length > 0 ? (
                  <div className="space-y-6">
                    {dashboardStats.slaByLocation.map((areaData: any, index: number) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="text-sm font-medium text-gray-900">{areaData.areaDetail}</h4>
                          <div className="text-sm text-gray-600">
                            <span className="font-semibold">{areaData.total}</span> positions with SLA
                          </div>
                        </div>
                        <div className="space-y-2">
                          {Object.entries(areaData.buckets).map(([bucket, count]: [string, any]) => (
                            <div key={bucket} className="flex items-center">
                              <div className="w-28 text-xs text-gray-600 truncate mr-2">{bucket}</div>
                              <button
                                className="flex-1 bg-gray-200 rounded-full h-2 group"
                                onClick={() => {
                                  const bucketMatch = (position: any) => {
                                    const nowDate = new Date()
                                    const dateValue = position?.fptkReceiveDate || position?.requestDate
                                    if (!dateValue) return false
                                    const d = new Date(dateValue)
                                    if (isNaN(d.getTime())) return false
                                    const diffDays = Math.floor((nowDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
                                    if (bucket === '0-30 Days') return diffDays <= 30
                                    if (bucket === '31-60 Days') return diffDays > 30 && diffDays <= 60
                                    if (bucket === '61-90 Days') return diffDays > 60 && diffDays <= 90
                                    return diffDays > 90
                                  }
                                  const items = filteredPositions
                                    .filter(
                                      (j: any) =>
                                        (j.areaDetail || j.area || j.location || 'Unknown') === areaData.areaDetail
                                    )
                                    .filter((j: any) => bucketMatch(j))
                                    .map((j: any) => ({
                                      title: j.title || j.position || 'Unknown Position',
                                      subtitle: `${j.department || 'N/A'} • ${j.location || 'N/A'}`,
                                      meta: `FPTK Received: ${
                                        j.fptkReceiveDate || j.requestDate
                                          ? new Date(j.fptkReceiveDate || j.requestDate).toLocaleDateString()
                                          : '-'
                                      }`,
                                    }))
                                  setDetailModal({ title: `${bucket} • ${areaData.areaDetail}`, items })
                                }}
                                title={`${bucket}: ${count} positions`}
                              >
                                <div
                                  className="bg-purple-500 h-2 rounded-full transition-all duration-300 group-hover:bg-purple-600"
                                  style={{ width: `${areaData.total > 0 ? (count / areaData.total) * 100 : 0}%` }}
                                ></div>
                              </button>
                              <button
                                className="w-8 text-xs text-gray-600 text-right ml-2 hover:underline"
                                onClick={() => {
                                  const bucketMatch = (position: any) => {
                                    const nowDate = new Date()
                                    const dateValue = position?.fptkReceiveDate || position?.requestDate
                                    if (!dateValue) return false
                                    const d = new Date(dateValue)
                                    if (isNaN(d.getTime())) return false
                                    const diffDays = Math.floor((nowDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
                                    if (bucket === '0-30 Days') return diffDays <= 30
                                    if (bucket === '31-60 Days') return diffDays > 30 && diffDays <= 60
                                    if (bucket === '61-90 Days') return diffDays > 60 && diffDays <= 90
                                    return diffDays > 90
                                  }
                                  const items = filteredPositions
                                    .filter(
                                      (j: any) =>
                                        (j.areaDetail || j.area || j.location || 'Unknown') === areaData.areaDetail
                                    )
                                    .filter((j: any) => bucketMatch(j))
                                    .map((j: any) => ({
                                      title: j.title || j.position || 'Unknown Position',
                                      subtitle: `${j.department || 'N/A'} • ${j.location || 'N/A'}`,
                                      meta: `FPTK Received: ${
                                        j.fptkReceiveDate || j.requestDate
                                          ? new Date(j.fptkReceiveDate || j.requestDate).toLocaleDateString()
                                          : '-'
                                      }`,
                                    }))
                                  setDetailModal({ title: `${bucket} • ${areaData.areaDetail}`, items })
                                }}
                              >
                                {count}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">No SLA data available.</div>
                )}
              </div>
            </div>
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
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setDetailModal(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{detailModal.title}</h2>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => setDetailModal(null)}>✕</button>
            </div>
            <div className="max-h-[60vh] overflow-auto px-6 py-4">
              {detailModal.items.length > 0 ? (
                <ul className="divide-y">
                  {detailModal.items.map((it, idx) => (
                    <li key={idx} className="py-3">
                      <div className="text-sm font-medium text-gray-900">{it.title}</div>
                      {it.subtitle && <div className="text-sm text-gray-600">{it.subtitle}</div>}
                      {it.meta && <div className="text-xs text-gray-500 mt-1">{it.meta}</div>}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-gray-500">No data available.</div>
              )}
            </div>
            <div className="px-6 py-4 border-t flex justify-end">
              <button className="px-4 py-2 text-sm rounded-md border text-gray-700 bg-white hover:bg-gray-50" onClick={() => setDetailModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}