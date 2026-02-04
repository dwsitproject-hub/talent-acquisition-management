"use client"

import { useEffect, useState } from 'react'
import Layout from '@/components/Layout/Layout'
import { FPTKAPI, ApplicationsAPI } from '@/lib/api'

interface StatusCounts {
  [status: string]: number
}

interface SummaryRow {
  priority: string
  division: string
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
  'Offer Extended',
  'Offer Accepted',
  'Rejected',
  'Withdrawn'
]

export default function SummaryByPositionPage() {
  const [rows, setRows] = useState<SummaryRow[]>([])
  const [allStatuses, setAllStatuses] = useState<string[]>([])
  const [priorityFilter, setPriorityFilter] = useState<string>('All')
  const [divisionFilter, setDivisionFilter] = useState<string>('All')
  const [sortKey, setSortKey] = useState<keyof SummaryRow>('position')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [divisions, setDivisions] = useState<string[]>([])

  useEffect(() => {
    loadSummaryData()
  }, [])

  // Map backend application status to UI status
  const mapApplicationStatusToUi = (status: string): string => {
    const statusMap: Record<string, string> = {
      'SUBMITTED': 'Applied',
      'SCREENING': 'Under Review',
      'PSYCHOMETRIC_TEST': 'Under Review',
      'TECHNICAL_TEST': 'Under Review',
      'INTERVIEW_SCHEDULED': 'Interview Scheduled',
      'INTERVIEW_COMPLETED': 'Interviewed',
      'DOCUMENT_VERIFICATION': 'Under Review',
      'OFFER_PROPOSED': 'Offer Extended',
      'OFFER_APPROVED': 'Offer Extended',
      'OFFER_SENT': 'Offer Extended',
      'OFFER_ACCEPTED': 'Offer Accepted',
      'OFFER_REJECTED': 'Rejected',
      'MEDICAL_CHECKUP_SCHEDULED': 'Under Review',
      'MEDICAL_CHECKUP_COMPLETED': 'Under Review',
      'CONTRACT_SENT': 'Offer Accepted',
      'CONTRACT_SIGNED': 'Offer Accepted',
      'ONBOARDING': 'Offer Accepted',
      'HIRED': 'Offer Accepted',
      'REJECTED': 'Rejected',
      'WITHDRAWN': 'Withdrawn',
    }
    return statusMap[status] || 'Applied'
  }

  const loadSummaryData = async () => {
    try {
      // Load job postings from API (max limit is 100, so we'll fetch in batches if needed)
      let allJobPostings: any[] = []
      let page = 1
      const limit = 100
      let hasMore = true
      
      while (hasMore) {
        const response = await FPTKAPI.getAll({}, { page, limit })
        const jobPostings = response.data || []
        allJobPostings = [...allJobPostings, ...jobPostings]
        
        // Check if there are more pages
        const totalPages = response.pagination?.totalPages || 1
        hasMore = page < totalPages
        page++
      }
      
      // Load all applications to get candidate counts per FPTK (max limit is 100)
      let allApplications: any[] = []
      page = 1
      hasMore = true
      
      while (hasMore) {
        const applicationsResponse = await ApplicationsAPI.getAll({}, { page, limit })
        const applications = applicationsResponse.data || []
        allApplications = [...allApplications, ...applications]
        
        // Check if there are more pages
        const totalPages = applicationsResponse.pagination?.totalPages || 1
        hasMore = page < totalPages
        page++
      }

      const collectedStatuses = new Set<string>(DEFAULT_STATUSES)

      const result: SummaryRow[] = allJobPostings.map((job: any) => {
        // Get applications for this FPTK
        const applications = allApplications.filter((app: any) => app.fptkId === job.id)
        
        // Build status counts from applications
        const counts: StatusCounts = {}
        DEFAULT_STATUSES.forEach(s => { counts[s] = 0 })

        // Count applications by their UI status
        applications.forEach((app: any) => {
          const uiStatus = mapApplicationStatusToUi(app.status)
          if (uiStatus && DEFAULT_STATUSES.includes(uiStatus)) {
            counts[uiStatus] = (counts[uiStatus] || 0) + 1
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
            const diffDays = Math.floor((new Date().getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24))
            if (diffDays <= 30) slaBucket = '0-30 Days'
            else if (diffDays <= 60) slaBucket = '31-60 Days'
            else if (diffDays <= 90) slaBucket = '61-90 Days'
            else slaBucket = 'Above 91 Days'
          }
        }

        return {
          priority: job.priority || job.urgentNormal || '—',
          division: job.department || job.division || '-',
          section: job.section || '-',
          position: job.positionTitle || job.position || job.title || '-',
          statusFktk: job.statusFktk || '-',
          remark: job.remark || '-',
          sla: slaBucket,
          counts,
        }
      })

      setAllStatuses([...DEFAULT_STATUSES])
      setRows(result)
      setDivisions(['All', ...Array.from(new Set(result.map(r => r.division))).filter(Boolean)])
    } catch (error: any) {
      console.error('Error loading summary data:', error)
      alert('Failed to load summary data. Please try again.')
      setRows([])
      setAllStatuses([...DEFAULT_STATUSES])
      setDivisions(['All'])
    }
  }

  const priorities = ['All', 'P0', 'P1', 'P2']

  const filteredRows = rows.filter(r => (
    (priorityFilter === 'All' || r.priority === priorityFilter) &&
    (divisionFilter === 'All' || r.division === divisionFilter)
  ))

  const sortedRows = [...filteredRows].sort((a, b) => {
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
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              {priorities.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Division</label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={divisionFilter}
              onChange={(e) => setDivisionFilter(e.target.value)}
            >
              {divisions.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:p-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th onClick={() => handleSort('priority')} className="cursor-pointer px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority {sortIndicator('priority')}</th>
                  <th onClick={() => handleSort('division')} className="cursor-pointer px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Division {sortIndicator('division')}</th>
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
                    <td colSpan={7 + allStatuses.length} className="px-4 py-6 text-center text-sm text-gray-500">
                      No data available. Create some positions and applied candidates to see the summary.
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
