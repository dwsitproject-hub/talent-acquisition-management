'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout/Layout'
import NewApplicationModal from '@/components/NewApplicationModal'
import ApplicationHistoryModal from '@/components/ApplicationHistoryModal'
import { Application } from '@/types'
import { ApplicationsAPI } from '@/lib/api'
import { PlusIcon, MagnifyingGlassIcon, EyeIcon, PencilIcon } from '@heroicons/react/24/outline'

export default function ApplicationsPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<10 | 50 | 100>(50)
  const [listMeta, setListMeta] = useState({ total: 0, totalPages: 1 })
  const [isNewApplicationModalOpen, setIsNewApplicationModalOpen] = useState(false)
  const [historyApplicationId, setHistoryApplicationId] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router])

  const loadApplications = async () => {
    try {
      setLoading(true)
      const response = await ApplicationsAPI.getAll(
        {
          ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
          ...(searchTerm.trim() ? { search: searchTerm.trim() } : {}),
        },
        { page, limit: pageSize }
      )
      const mapped: Application[] = ((response as any).data || []).map((app: any) => ({
        id: app.id,
        candidateId: app.candidateId,
        candidate: app.candidate,
        fptkId: app.fptkId,
        fptk: {
          ...(app.fptk || {}),
          title: app.fptk?.positionTitle || app.fptk?.title || '—',
          department: app.fptk?.department || '—',
          location: app.fptk?.department || '—',
        },
        status: (app.status || '').toString().toLowerCase(),
        stage: app.currentStage,
        appliedAt: app.appliedAt,
        notes: app.notes || '',
        documents: [],
        interviews: app.interviews || [],
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
      }))
      setApplications(mapped)
      const pag = (response as any).pagination || {}
      setListMeta({
        total: typeof pag.total === 'number' ? pag.total : mapped.length,
        totalPages: Math.max(1, pag.totalPages ?? 1),
      })
    } catch (error) {
      console.error('Failed to load applications:', error)
      setApplications([])
      setListMeta({ total: 0, totalPages: 1 })
    } finally {
      setLoading(false)
    }
  }

  const appListBootRef = useRef(true)
  useEffect(() => {
    if (!isAuthenticated || isLoading) return
    if (appListBootRef.current) {
      appListBootRef.current = false
      return
    }
    setPage(1)
  }, [searchTerm, statusFilter, pageSize, isAuthenticated, isLoading])

  useEffect(() => {
    if (!isAuthenticated || isLoading) return
    const delay = searchTerm ? 350 : 0
    const timer = setTimeout(() => {
      loadApplications()
    }, delay)
    return () => clearTimeout(timer)
  }, [page, pageSize, searchTerm, statusFilter, isAuthenticated, isLoading])

  const handleNewApplication = (applicationData: any) => {
    const newApplication: Application = {
      id: Date.now().toString(),
      candidateId: applicationData.candidateId,
      candidate: applicationData.candidate,
      fptkId: applicationData.fptkId,
      fptk: applicationData.fptk,
      status: applicationData.status,
      stage: applicationData.stage,
      appliedAt: applicationData.appliedAt,
      notes: applicationData.notes,
      documents: applicationData.documents,
      interviews: applicationData.interviews,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    setApplications(prev => [...prev, newApplication])
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

  const filteredApplications = applications

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
      case 'submitted':
      case 'applied':
        return 'bg-blue-100 text-blue-800'
      case 'screening':
      case 'under_review':
        return 'bg-yellow-100 text-yellow-800'
      case 'psychometric_test':
      case 'technical_test':
      case 'shortlisted':
        return 'bg-green-100 text-green-800'
      case 'interview_scheduled':
        return 'bg-purple-100 text-purple-800'
      case 'interviewed':
        return 'bg-indigo-100 text-indigo-800'
      case 'offer_extended':
        return 'bg-emerald-100 text-emerald-800'
      case 'offer_accepted':
        return 'bg-green-100 text-green-800'
      case 'offer_declined':
        return 'bg-red-100 text-red-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      case 'withdrawn':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Layout>
      <div>
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage job applications and track candidate progress
              </p>
            </div>
            <button 
              onClick={() => setIsNewApplicationModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              New Application
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-4 sm:space-y-0 sm:flex sm:items-center sm:space-x-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search applications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="block w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          >
            <option value="all">All Status</option>
            <option value="SUBMITTED">Applied</option>
            <option value="SCREENING">Under Review</option>
            <option value="TECHNICAL_TEST">Assessment</option>
            <option value="INTERVIEW_SCHEDULED">Interview Scheduled</option>
            <option value="INTERVIEW_COMPLETED">Interviewed</option>
            <option value="OFFER_SENT">Offer Sent</option>
            <option value="OFFER_ACCEPTED">Offer Accepted</option>
            <option value="REJECTED">Rejected</option>
            <option value="WITHDRAWN">Withdrawn</option>
          </select>
          <div className="flex items-center gap-2 sm:ml-auto">
            <label className="text-sm text-gray-600 whitespace-nowrap">Rows per page</label>
            <select
              className="block rounded-md border-0 py-1.5 pl-3 pr-8 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value) as 10 | 50 | 100)}
            >
              <option value={10}>10</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Applications List */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Loading applications...</p>
            </div>
          ) : filteredApplications.length === 0 ? (
            <div className="p-6 text-center">
              <div className="mx-auto h-12 w-12 text-gray-400">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No applications</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating a new application or wait for candidates to apply.
              </p>
              <div className="mt-6">
                <button 
                  onClick={() => setIsNewApplicationModalOpen(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  New Application
                </button>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {filteredApplications.map((application) => (
                <li key={application.id}>
                  <div className="px-4 py-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center flex-1">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-indigo-600">
                            {application.candidate.user.firstName.charAt(0)}
                            {application.candidate.user.lastName.charAt(0)}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4 flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {application.candidate.user.firstName} {application.candidate.user.lastName}
                            </p>
                            <p className="text-sm text-gray-500">{application.candidate.user.email}</p>
                          </div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(application.status)}`}>
                            {application.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="mt-1">
                          <p className="text-sm text-gray-600">
                            Applied for <span className="font-medium">{application.fptk.title}</span>
                          </p>
                          <p className="text-sm text-gray-500">
                            {application.fptk.department} • {application.fptk.location}
                          </p>
                        </div>
                        <div className="mt-1 text-sm text-gray-500">
                          <p>Applied {new Date(application.appliedAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => setHistoryApplicationId(application.id)}
                        className="text-indigo-600 hover:text-indigo-900 text-sm font-medium flex items-center"
                        title="View status history"
                      >
                        <EyeIcon className="h-4 w-4 mr-1" />
                        History
                      </button>
                      <button className="text-gray-400 hover:text-gray-600 text-sm font-medium flex items-center">
                        <PencilIcon className="h-4 w-4 mr-1" />
                        Edit
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600">
          <span>
            {listMeta.total === 0
              ? 'Showing 0 of 0'
              : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, listMeta.total)} of ${listMeta.total}`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="tabular-nums">
              Page {Math.min(page, listMeta.totalPages)} / {listMeta.totalPages}
            </span>
            <button
              type="button"
              disabled={page >= listMeta.totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>

        {/* New Application Modal */}
        <NewApplicationModal
          isOpen={isNewApplicationModalOpen}
          onClose={() => setIsNewApplicationModalOpen(false)}
          onSave={handleNewApplication}
        />

        {/* Application Status History Modal */}
        <ApplicationHistoryModal
          isOpen={historyApplicationId !== null}
          onClose={() => setHistoryApplicationId(null)}
          applicationId={historyApplicationId}
        />
      </div>
    </Layout>
  )
}
