"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import Layout from '@/components/Layout/Layout'
import { FPTKAPI } from '@/lib/api'
import MultiSelectDropdown from '@/components/MultiSelectDropdown'
import { getSlaBucketIndonesiaWorkingDays } from '@/utils/indoBusinessDays'

interface StatusCounts {
  [status: string]: number
}

interface SummaryRow {
  priority: string
  division: string
  location: string
  section: string
  position: string
  statusFktk: string
  remark: string
  sla: string
  counts: StatusCounts
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

const isClosedPosition = (statusFktk: string) => {
  const s = (statusFktk || '').toString().trim().toLowerCase()
  return (
    s.includes('cancel') ||
    s.includes('on boarding') ||
    s.includes('onboarding') ||
    s.includes('boarding') ||
    s.includes('signing')
  )
}

type SummaryCardKey = 'open' | 'closed' | 'sla-0-30' | 'sla-31-60' | 'sla-61-90' | 'sla-91'

export default function SummaryByPositionPage() {
  const [rows, setRows] = useState<SummaryRow[]>([])
  const [allStatuses, setAllStatuses] = useState<string[]>([])
  const [priorityFilter, setPriorityFilter] = useState<string[]>([])
  const [divisionFilter, setDivisionFilter] = useState<string[]>([])
  const [locationFilter, setLocationFilter] = useState<string[]>([])
  const [sortKey, setSortKey] = useState<keyof SummaryRow>('position')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [activeCard, setActiveCard] = useState<SummaryCardKey | null>(null)
  const [divisions, setDivisions] = useState<string[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const topScrollRef = useRef<HTMLDivElement | null>(null)
  const bottomScrollRef = useRef<HTMLDivElement | null>(null)
  const tableRef = useRef<HTMLTableElement | null>(null)
  const [topScrollWidth, setTopScrollWidth] = useState(0)

  useEffect(() => {
    const update = () => {
      const w = tableRef.current?.scrollWidth || 0
      setTopScrollWidth(w)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [rows, allStatuses, sortKey, sortDir])

  const syncScroll = (src: 'top' | 'bottom') => {
    const top = topScrollRef.current
    const bottom = bottomScrollRef.current
    if (!top || !bottom) return
    if (src === 'top') bottom.scrollLeft = top.scrollLeft
    else top.scrollLeft = bottom.scrollLeft
  }

  useEffect(() => {
    loadSummaryData()
  }, [])

  // Map backend application status to UI status
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

  const loadSummaryData = async () => {
    try {
      const payload = await FPTKAPI.getSummaryByPosition()
      const allJobPostings: any[] = payload?.fptks || []
      const applicationCounts: Record<string, Record<string, number>> = payload?.applicationCounts || {}

      const collectedStatuses = new Set<string>(DEFAULT_STATUSES)

      const result: SummaryRow[] = allJobPostings.map((job: any) => {
        // Build status counts from pre-aggregated backend counts
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

        // SLA bucket based on FPTK Receive Date (fallback to requestDate if receiveDate not available)
        // Use same logic as dashboard: fptkReceiveDate || requestDate
        const referenceDate = job.fptkReceiveDate || job.requestDate || job.createdAt
        let slaBucket = '-'
        if (referenceDate) {
          const dateObj = new Date(referenceDate)
          if (!isNaN(dateObj.getTime())) {
            slaBucket = getSlaBucketIndonesiaWorkingDays(dateObj, new Date())
          }
        }

        return {
          priority: job.priority || job.urgentNormal || '—',
          division: job.department || job.division || '-',
          location: job.areaDetail || job.area || job.location || '-',
          section: job.section || '-',
          position: job.positionTitle || job.position || job.title || '-',
          statusFktk: job.statusFktk || '-',
          remark: job.remark || '-',
          sla: slaBucket,
          counts,
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
    } catch (error: any) {
      console.error('Error loading summary data:', error)
      alert('Failed to load summary data. Please try again.')
      setRows([])
      setAllStatuses([...DEFAULT_STATUSES])
      setDivisions([])
      setLocations([])
    }
  }

  const priorities = ['P0', 'P1', 'P2']

  const dropdownFilteredRows = useMemo(
    () =>
      rows.filter((r) => {
        const priorityOk = priorityFilter.length === 0 || priorityFilter.includes(r.priority)
        const divisionOk = divisionFilter.length === 0 || divisionFilter.includes(r.division)
        const locationOk = locationFilter.length === 0 || locationFilter.includes(r.location)
        return priorityOk && divisionOk && locationOk
      }),
    [rows, priorityFilter, divisionFilter, locationFilter]
  )

  const tableRows = useMemo(() => {
    if (!activeCard) return dropdownFilteredRows
    switch (activeCard) {
      case 'open':
        return dropdownFilteredRows.filter((r) => !isClosedPosition(r.statusFktk))
      case 'closed':
        return dropdownFilteredRows.filter((r) => isClosedPosition(r.statusFktk))
      case 'sla-0-30':
        return dropdownFilteredRows.filter((r) => r.sla === '0-30 Days')
      case 'sla-31-60':
        return dropdownFilteredRows.filter((r) => r.sla === '31-60 Days')
      case 'sla-61-90':
        return dropdownFilteredRows.filter((r) => r.sla === '61-90 Days')
      case 'sla-91':
        return dropdownFilteredRows.filter((r) => r.sla === 'Above 91 Days')
      default:
        return dropdownFilteredRows
    }
  }, [dropdownFilteredRows, activeCard])

  const openPositionCount = dropdownFilteredRows.filter((r) => !isClosedPosition(r.statusFktk)).length
  const closedPositionCount = dropdownFilteredRows.filter((r) => isClosedPosition(r.statusFktk)).length

  const slaCounts = useMemo(() => {
    const counts: Record<string, number> = {
      '0-30 Days': 0,
      '31-60 Days': 0,
      '61-90 Days': 0,
      'Above 91 Days': 0,
    }
    dropdownFilteredRows.forEach((r) => {
      if (r.sla in counts) {
        counts[r.sla] += 1
      }
    })
    return counts
  }, [dropdownFilteredRows])

  const sortedRows = [...tableRows].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    const av = (a[sortKey] ?? '').toString().toLowerCase()
    const bv = (b[sortKey] ?? '').toString().toLowerCase()
    if (av < bv) return -1 * dir
    if (av > bv) return 1 * dir
    return 0
  })

  const handleSort = (key: keyof SummaryRow) => {
    if (sortKey === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const toggleCardFilter = (key: SummaryCardKey) => {
    setActiveCard((prev) => (prev === key ? null : key))
  }

  const cardClass = (key: SummaryCardKey) => {
    const on = activeCard === key
    return [
      'w-full text-left bg-white shadow rounded-lg px-4 py-5 sm:px-6',
      'transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
      on ? 'ring-2 ring-indigo-500 border border-indigo-200 bg-indigo-50/50' : 'hover:border hover:border-gray-200 cursor-pointer',
    ].join(' ')
  }

  const sortIndicator = (key: keyof SummaryRow) => (
    <span className="ml-1 text-gray-400">{sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
  )

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Summary by Position</h1>
            <p className="mt-1 text-sm text-gray-500">Open Position status breakdown by Priority, Division, Section, and Position.</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white shadow rounded-lg p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MultiSelectDropdown
            label="Priority"
            options={priorities}
            value={priorityFilter}
            onChange={setPriorityFilter}
            placeholder="All priorities"
            searchPlaceholder="Search priority..."
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
            label="Location"
            options={locations}
            value={locationFilter}
            onChange={setLocationFilter}
            placeholder="All locations"
            searchPlaceholder="Type location..."
          />
        </div>

        <p className="text-sm text-gray-500">
          Click a card to filter the table. Click the same card again to show all rows (still respects Priority, Division, Location).
        </p>

        {/* Open / Closed + SLA cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <button type="button" onClick={() => toggleCardFilter('open')} className={cardClass('open')}>
            <div className="text-sm font-medium text-gray-500">Open Position</div>
            <div className="mt-2 text-3xl font-semibold text-gray-900">{openPositionCount}</div>
            <div className="mt-1 text-xs text-gray-400">By Status FKTK • with dropdown filters</div>
          </button>
          <button type="button" onClick={() => toggleCardFilter('closed')} className={cardClass('closed')}>
            <div className="text-sm font-medium text-gray-500">Closed Position</div>
            <div className="mt-2 text-3xl font-semibold text-gray-900">{closedPositionCount}</div>
            <div className="mt-1 text-xs text-gray-400">By Status FKTK • with dropdown filters</div>
          </button>
          <button type="button" onClick={() => toggleCardFilter('sla-0-30')} className={cardClass('sla-0-30')}>
            <div className="text-sm font-medium text-gray-500">SLA 0-30 Days</div>
            <div className="mt-2 text-3xl font-semibold text-gray-900">{slaCounts['0-30 Days']}</div>
            <div className="mt-1 text-xs text-gray-400">Working days (ID) • with dropdown filters</div>
          </button>
          <button type="button" onClick={() => toggleCardFilter('sla-31-60')} className={cardClass('sla-31-60')}>
            <div className="text-sm font-medium text-gray-500">SLA 31-60 Days</div>
            <div className="mt-2 text-3xl font-semibold text-gray-900">{slaCounts['31-60 Days']}</div>
            <div className="mt-1 text-xs text-gray-400">Working days (ID) • with dropdown filters</div>
          </button>
          <button type="button" onClick={() => toggleCardFilter('sla-61-90')} className={cardClass('sla-61-90')}>
            <div className="text-sm font-medium text-gray-500">SLA 61-90 Days</div>
            <div className="mt-2 text-3xl font-semibold text-gray-900">{slaCounts['61-90 Days']}</div>
            <div className="mt-1 text-xs text-gray-400">Working days (ID) • with dropdown filters</div>
          </button>
          <button type="button" onClick={() => toggleCardFilter('sla-91')} className={cardClass('sla-91')}>
            <div className="text-sm font-medium text-gray-500">SLA Above 91 Days</div>
            <div className="mt-2 text-3xl font-semibold text-gray-900">{slaCounts['Above 91 Days']}</div>
            <div className="mt-1 text-xs text-gray-400">Working days (ID) • with dropdown filters</div>
          </button>
        </div>

        <div className="bg-white shadow rounded-lg overflow-hidden">
          {/* Top horizontal scrollbar */}
          <div
            ref={topScrollRef}
            onScroll={() => syncScroll('top')}
            className="px-4 pt-4 sm:px-6 overflow-x-auto"
          >
            <div style={{ width: topScrollWidth || 0, height: 1 }} />
          </div>

          {/* Table container (bottom scrollbar) */}
          <div
            ref={bottomScrollRef}
            onScroll={() => syncScroll('bottom')}
            className="px-4 py-5 sm:p-6 overflow-x-auto"
          >
            <table ref={tableRef} className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th onClick={() => handleSort('priority')} className="cursor-pointer px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority {sortIndicator('priority')}</th>
                  <th onClick={() => handleSort('division')} className="cursor-pointer px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Division {sortIndicator('division')}</th>
                  <th onClick={() => handleSort('location')} className="cursor-pointer px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location {sortIndicator('location')}</th>
                  <th onClick={() => handleSort('section')} className="cursor-pointer px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Section {sortIndicator('section')}</th>
                  <th onClick={() => handleSort('position')} className="cursor-pointer px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position {sortIndicator('position')}</th>
                  <th onClick={() => handleSort('statusFktk')} className="cursor-pointer px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status FKTK {sortIndicator('statusFktk')}</th>
                  <th onClick={() => handleSort('remark')} className="cursor-pointer px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remark {sortIndicator('remark')}</th>
                  <th onClick={() => handleSort('sla')} className="cursor-pointer px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SLA {sortIndicator('sla')}</th>
                  {allStatuses.map((status) => (
                    <th key={status} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{status}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedRows.map((row, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{row.priority}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{row.division}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{row.location}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{row.section}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{row.position}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{row.statusFktk}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 max-w-xs truncate" title={row.remark}>{row.remark}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{row.sla}</td>
                    {allStatuses.map((status) => (
                      <td key={status} className="px-4 py-2 whitespace-nowrap text-sm">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          {row.counts[status] ?? 0}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8 + allStatuses.length} className="px-4 py-6 text-center text-sm text-gray-500">
                      No data available. Create some positions and applied candidates to see the summary.
                    </td>
                  </tr>
                )}
                {rows.length > 0 && sortedRows.length === 0 && (
                  <tr>
                    <td colSpan={8 + allStatuses.length} className="px-4 py-6 text-center text-sm text-gray-500">
                      No rows match the selected card filter. Clear the card or adjust Priority, Division, or Location.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  )
}
