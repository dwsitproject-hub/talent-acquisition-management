'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout/Layout'
import { DocumentArrowDownIcon } from '@heroicons/react/24/outline'
import { FPTKAPI } from '@/lib/api'

const PRIORITY_OPTIONS = ['P0', 'P1', 'P2', 'Normal']
const STATUS_OPTIONS = [
  'Raise FPTK',
  'CV Hunting (Sourcing Candidate)',
  'Piskotest & Technical Test',
  'Interview User',
  'Offering Process',
  'Medical Check Up (MCU)',
  'Signing',
  'On Boarding'
]

export default function ReportsPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [requestDateStart, setRequestDateStart] = useState<string>('')
  const [requestDateEnd, setRequestDateEnd] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router])

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

  const toggleSelection = (value: string, selected: string[], setter: (next: string[]) => void) => {
    setter(selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value])
  }

  const isDownloadDisabled = useMemo(() => downloading || loading, [downloading, loading])

  const mapPriorityValue = (priority?: string | null) => {
    if (!priority) return 'Normal'
    const normalized = priority.toString().toUpperCase()
    if (['P0', 'P1', 'P2'].includes(normalized)) return normalized
    return 'Normal'
  }

  const fetchPositions = async () => {
    const limit = 100
    let page = 1
    let allPositions: any[] = []
    let hasMore = true

    while (hasMore) {
      const response = await FPTKAPI.getAll({ search: '' }, { page, limit })
      const items = response.data ?? []
      allPositions = [...allPositions, ...items]

      const totalPages = response.pagination?.totalPages
      if (totalPages) {
        hasMore = page < totalPages
      } else {
        hasMore = items.length === limit
      }

      page += 1
      if (!hasMore) break
    }

    return allPositions
  }

  const matchesFilters = (position: any) => {
    const priorityLabel = mapPriorityValue(position.priority || position.urgentNormal)
    if (selectedPriorities.length > 0 && !selectedPriorities.includes(priorityLabel)) return false

    if (selectedStatuses.length > 0) {
      const currentStatus = position.currentStatus || position.status || 'Raise FPTK'
      if (!selectedStatuses.includes(currentStatus)) return false
    }

    if (requestDateStart) {
      const requestDate = position.requestDate ? new Date(position.requestDate) : null
      if (!requestDate || requestDate < new Date(requestDateStart)) return false
    }

    if (requestDateEnd) {
      const requestDate = position.requestDate ? new Date(position.requestDate) : null
      if (!requestDate || requestDate > new Date(requestDateEnd)) return false
    }

    return true
  }

  const convertToCsv = (rows: any[]) => {
    if (!rows.length) return ''
    const headers = [
      'No',
      'Priority',
      'Position Title',
      'Division',
      'Section',
      'Hiring Manager',
      'Employment Type',
      'Location',
      'Current Status',
      'Request Date',
      'Total Request',
      'Status FKTK',
      'Area Detail'
    ]

    const csvRows = rows.map((row, index) => [
      index + 1,
      mapPriorityValue(row.priority || row.urgentNormal),
      row.position || row.title || '',
      row.department || row.division || '',
      row.section || '',
      row.hiringManager || '',
      row.employmentType || row.type || '',
      row.location || '',
      row.currentStatus || row.status || '',
      row.requestDate ? new Date(row.requestDate).toLocaleDateString() : '',
      row.totalRequest || row.numberOfPositions || '',
      row.statusFktk || '',
      row.areaDetail || ''
    ])

    const allRows = [headers, ...csvRows]

    return allRows
      .map(row => row.map(value => {
        if (value === null || value === undefined) return ''
        const stringValue = value.toString()
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`
        }
        return stringValue
      }).join(','))
      .join('\n')
  }

  const handleDownload = async () => {
    try {
      setDownloading(true)
      setErrorMessage('')
      const positions = await fetchPositions()
      const filtered = positions.filter(matchesFilters)
      if (filtered.length === 0) {
        setErrorMessage('No positions match the selected filters.')
        return
      }
      const csv = convertToCsv(filtered)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `position_raw_data_report_${Date.now()}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download report', error)
      const message =
        (error as any)?.response?.data?.message ||
        (error as any)?.message ||
        'Failed to generate the report. Please try again.'
      setErrorMessage(message)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Layout>
      <div>
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
              <p className="mt-1 text-sm text-gray-500">
                Download operational reports for talent acquisition
              </p>
            </div>
          </div>
        </div>

        {/* Position Raw Data Report */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-6 py-5 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Position Raw Data Report</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Download all position data currently available on the Position page.
                </p>
              </div>
              <button
                onClick={handleDownload}
                disabled={isDownloadDisabled}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${
                  isDownloadDisabled ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'
                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
              >
                <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                {downloading ? 'Generating...' : 'Download CSV'}
              </button>
            </div>
          </div>

          <div className="px-6 py-5 space-y-6">
            {/* Priority Filter */}
            <div>
              <h3 className="text-sm font-medium text-gray-700">Priority</h3>
              <p className="text-xs text-gray-500 mb-2">Select one or more priority levels</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {PRIORITY_OPTIONS.map(option => (
                  <label key={option} className="flex items-center space-x-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={selectedPriorities.includes(option)}
                      onChange={() => toggleSelection(option, selectedPriorities, setSelectedPriorities)}
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Request Date Filter */}
            <div>
              <h3 className="text-sm font-medium text-gray-700">Request Date Range</h3>
              <p className="text-xs text-gray-500 mb-2">Filter by request date</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={requestDateStart}
                    onChange={(e) => setRequestDateStart(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
                  <input
                    type="date"
                    value={requestDateEnd}
                    onChange={(e) => setRequestDateEnd(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Current Status Filter */}
            <div>
              <h3 className="text-sm font-medium text-gray-700">Position Current Status</h3>
              <p className="text-xs text-gray-500 mb-2">Select one or more statuses</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {STATUS_OPTIONS.map(option => (
                  <label key={option} className="flex items-center space-x-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={selectedStatuses.includes(option)}
                      onChange={() => toggleSelection(option, selectedStatuses, setSelectedStatuses)}
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>

            {errorMessage && (
              <div className="text-sm text-red-600">
                {errorMessage}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
