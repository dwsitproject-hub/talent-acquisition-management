'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout/Layout'
import NewApplicationModal from '@/components/NewApplicationModal'
import { Application } from '@/types'
import { PlusIcon, MagnifyingGlassIcon, EyeIcon, PencilIcon } from '@heroicons/react/24/outline'

export default function ApplicationsPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isNewApplicationModalOpen, setIsNewApplicationModalOpen] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router])

  useEffect(() => {
    // Load applications from localStorage (only in browser)
    if (typeof window !== 'undefined') {
      try {
        const storedApplications = localStorage.getItem('applications')
        if (storedApplications) {
          setApplications(JSON.parse(storedApplications))
        }
      } catch (error) {
        console.warn('Could not load applications from localStorage:', error)
      }
    }
    setLoading(false)
  }, [])

  // Save applications to localStorage whenever applications change
  useEffect(() => {
    if (typeof window !== 'undefined' && applications.length > 0) {
      try {
        localStorage.setItem('applications', JSON.stringify(applications))
      } catch (error) {
        console.warn('Could not save applications to localStorage:', error)
      }
    }
  }, [applications])

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

  const filteredApplications = applications.filter(application => {
    const matchesSearch = 
      application.candidate.user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      application.candidate.user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      application.candidate.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      application.fptk.title.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || application.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'applied':
        return 'bg-blue-100 text-blue-800'
      case 'under_review':
        return 'bg-yellow-100 text-yellow-800'
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
            <option value="applied">Applied</option>
            <option value="under_review">Under Review</option>
            <option value="shortlisted">Shortlisted</option>
            <option value="interview_scheduled">Interview Scheduled</option>
            <option value="interviewed">Interviewed</option>
            <option value="offer_extended">Offer Extended</option>
            <option value="offer_accepted">Offer Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="withdrawn">Withdrawn</option>
          </select>
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
                      <button className="text-indigo-600 hover:text-indigo-900 text-sm font-medium flex items-center">
                        <EyeIcon className="h-4 w-4 mr-1" />
                        View
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

        {/* New Application Modal */}
        <NewApplicationModal
          isOpen={isNewApplicationModalOpen}
          onClose={() => setIsNewApplicationModalOpen(false)}
          onSave={handleNewApplication}
        />
      </div>
    </Layout>
  )
}
