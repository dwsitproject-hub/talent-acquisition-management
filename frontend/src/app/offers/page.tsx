'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout/Layout'
import { PlusIcon, MagnifyingGlassIcon, DocumentTextIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface Offer {
  id: string
  offerNumber: string
  candidateName: string
  candidateEmail: string
  jobTitle: string
  department: string
  status: string
  basicSalary: number
  totalPackage: number
  createdAt: string
  respondedAt?: string
}

export default function OffersPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router])

  useEffect(() => {
    // TODO: Fetch offers from API
    // This will be implemented when the backend API endpoints are ready
    setLoading(false)
  }, [])

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

  const filteredOffers = offers.filter(offer => {
    const matchesSearch = 
      offer.candidateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      offer.candidateEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      offer.jobTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      offer.offerNumber.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || offer.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800'
      case 'pending_hrbp_review':
        return 'bg-yellow-100 text-yellow-800'
      case 'pending_head_approval':
        return 'bg-orange-100 text-orange-800'
      case 'approved':
        return 'bg-blue-100 text-blue-800'
      case 'sent_to_candidate':
        return 'bg-purple-100 text-purple-800'
      case 'accepted':
        return 'bg-green-100 text-green-800'
      case 'rejected_by_candidate':
        return 'bg-red-100 text-red-800'
      case 'negotiation':
        return 'bg-indigo-100 text-indigo-800'
      case 'expired':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <Layout>
      <div>
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Job Offers</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage job offers and track offer responses
              </p>
            </div>
            <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              <PlusIcon className="h-4 w-4 mr-2" />
              Create Offer
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
              placeholder="Search offers..."
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
            <option value="draft">Draft</option>
            <option value="pending_hrbp_review">Pending HRBP Review</option>
            <option value="pending_head_approval">Pending Head Approval</option>
            <option value="approved">Approved</option>
            <option value="sent_to_candidate">Sent to Candidate</option>
            <option value="accepted">Accepted</option>
            <option value="rejected_by_candidate">Rejected by Candidate</option>
            <option value="negotiation">Negotiation</option>
            <option value="expired">Expired</option>
          </select>
        </div>

        {/* Offers List */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Loading offers...</p>
            </div>
          ) : filteredOffers.length === 0 ? (
            <div className="p-6 text-center">
              <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No offers</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating a new job offer.
              </p>
              <div className="mt-6">
                <button className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Create Offer
                </button>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {filteredOffers.map((offer) => (
                <li key={offer.id}>
                  <div className="px-4 py-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center flex-1">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                          <DocumentTextIcon className="h-6 w-6 text-indigo-600" />
                        </div>
                      </div>
                      <div className="ml-4 flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {offer.candidateName}
                            </p>
                            <p className="text-sm text-gray-500">{offer.candidateEmail}</p>
                          </div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(offer.status)}`}>
                            {offer.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="mt-1">
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">{offer.jobTitle}</span> • {offer.department}
                          </p>
                          <p className="text-sm text-gray-500">
                            Offer #{offer.offerNumber}
                          </p>
                        </div>
                        <div className="mt-1 flex items-center text-sm text-gray-500">
                          <span className="font-medium">{formatCurrency(offer.basicSalary)}</span>
                          <span className="mx-2">•</span>
                          <span>Total: {formatCurrency(offer.totalPackage)}</span>
                        </div>
                        <div className="mt-1 text-sm text-gray-500">
                          <p>Created {new Date(offer.createdAt).toLocaleDateString()}</p>
                          {offer.respondedAt && (
                            <p>Responded {new Date(offer.respondedAt).toLocaleDateString()}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button className="text-indigo-600 hover:text-indigo-900 text-sm font-medium">
                        View
                      </button>
                      <button className="text-gray-400 hover:text-gray-600 text-sm font-medium">
                        Edit
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Layout>
  )
}
