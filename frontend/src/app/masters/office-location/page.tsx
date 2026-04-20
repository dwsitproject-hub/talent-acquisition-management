'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout/Layout'
import { PlusIcon, PencilIcon, TrashIcon, EyeIcon } from '@heroicons/react/24/outline'
import { MasterOfficeLocationAPI, MenuAccessAPI } from '@/lib/api'

function mapEnumToRole(role: string): string {
  const roleMap: Record<string, string> = {
    SUPER_ADMIN: 'SUPER_ADMIN',
    CHRO: 'Management',
    DEPARTMENT_HEAD: 'Head of Division',
    HRBP: 'HRBP',
    TA_TEAM: 'TA_TEAM',
    HIRING_MANAGER: 'HIRING_MANAGER',
    INTERVIEWER: 'INTERVIEWER',
    CANDIDATE: 'CANDIDATE',
  }
  return roleMap[role] || role
}
import BulkUploadModal from '@/components/BulkUploadModal'

interface OfficeLocation {
  id: string
  pt: string
  area: string
  areaDetail: string
  createdAt: string
  updatedAt: string
}

export default function MasterOfficeLocationPage() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()
  const [officeLocations, setOfficeLocations] = useState<OfficeLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<10 | 50 | 100>(50)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [selectedOfficeLocation, setSelectedOfficeLocation] = useState<OfficeLocation | null>(null)
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false)
  const [menuAccess, setMenuAccess] = useState<Record<string, any>>({})
  const [menuAccessLoading, setMenuAccessLoading] = useState(true)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router])

  useEffect(() => {
    let isMounted = true
    const loadMenuAccess = async () => {
      if (!isAuthenticated || isLoading || !isMounted) return
      try {
        const access = await MenuAccessAPI.get()
        if (isMounted) setMenuAccess(access || {})
      } catch {
        if (isMounted) setMenuAccess({})
      } finally {
        if (isMounted) setMenuAccessLoading(false)
      }
    }
    if (isAuthenticated && !isLoading) {
      loadMenuAccess()
    } else {
      setMenuAccess({})
      setMenuAccessLoading(false)
    }
    return () => {
      isMounted = false
    }
  }, [isAuthenticated, isLoading])

  const loadOfficeLocations = async (search?: string) => {
    try {
      setLoading(true)
      const data = await MasterOfficeLocationAPI.getAll(search || searchTerm)
      setOfficeLocations(data)
    } catch (error) {
      console.error('Error loading office locations:', error)
      alert('Failed to load office locations. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOfficeLocations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reload office locations when search term changes (with debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      loadOfficeLocations(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const handleAddOfficeLocation = async (officeLocationData: Omit<OfficeLocation, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newOfficeLocation = await MasterOfficeLocationAPI.create(officeLocationData)
      setOfficeLocations(prev => [...prev, newOfficeLocation])
      setIsAddModalOpen(false)
    } catch (error: any) {
      console.error('Error adding office location:', error)
      alert(error.response?.data?.message || 'Failed to add office location. Please try again.')
    }
  }

  const handleEditOfficeLocation = async (officeLocationData: OfficeLocation) => {
    try {
      const updatedOfficeLocation = await MasterOfficeLocationAPI.update(officeLocationData.id, {
        pt: officeLocationData.pt,
        area: officeLocationData.area,
        areaDetail: officeLocationData.areaDetail,
      })
      setOfficeLocations(prev => prev.map(loc => loc.id === officeLocationData.id ? updatedOfficeLocation : loc))
      setIsEditModalOpen(false)
      setSelectedOfficeLocation(null)
    } catch (error: any) {
      console.error('Error updating office location:', error)
      alert(error.response?.data?.message || 'Failed to update office location. Please try again.')
    }
  }

  const handleDeleteOfficeLocation = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this office location?')) {
      try {
        await MasterOfficeLocationAPI.delete(id)
        setOfficeLocations(prev => prev.filter(officeLocation => officeLocation.id !== id))
      } catch (error: any) {
        console.error('Error deleting office location:', error)
        alert(error.response?.data?.message || 'Failed to delete office location. Please try again.')
      }
    }
  }

  useEffect(() => {
    setPage(1)
  }, [searchTerm, pageSize])

  const filteredOfficeLocations = officeLocations
  const totalPages = Math.max(1, Math.ceil(filteredOfficeLocations.length / pageSize))
  const pagedOfficeLocations = useMemo(() => {
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * pageSize
    return filteredOfficeLocations.slice(start, start + pageSize)
  }, [filteredOfficeLocations, page, pageSize, totalPages])

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

  const backendRole = (user as any)?.role?.name || (user as any)?.role || 'TA_TEAM'
  const roleName = mapEnumToRole(backendRole)
  const cfg = menuAccess['/masters/office-location'] || {}
  const visibleRoles: string[] = cfg.visibleRoles && cfg.visibleRoles.length ? cfg.visibleRoles : [
    'SUPER_ADMIN',
    'Management',
    'Head of Division',
    'HRBP',
    'TA_TEAM',
  ]

  if (menuAccessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!visibleRoles.includes(roleName)) {
    router.push('/')
    return null
  }

  const perms = cfg.permissions || {
    view: visibleRoles,
    create: ['SUPER_ADMIN', 'TA_TEAM'],
    edit: ['SUPER_ADMIN', 'TA_TEAM'],
  }
  const canCreate = (perms.create || []).includes(roleName) || (perms.create || []).includes('*')
  const canEdit = (perms.edit || []).includes(roleName) || (perms.edit || []).includes('*')

  return (
    <Layout>
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Master Office Location</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage office location information including area and area details
          </p>
        </div>

        {/* Search and Add Button */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1 max-w-lg">
            <input
              type="text"
              placeholder="Search office locations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">Per page</label>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value) as 10 | 50 | 100)}
              className="px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value={10}>10</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <button
              type="button"
              disabled={!canCreate}
              onClick={() => canCreate && setIsBulkUploadOpen(true)}
              className={`inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md ${
                canCreate ? 'border-gray-300 text-gray-900 hover:bg-gray-50' : 'border-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Bulk Upload
            </button>
            <button
              type="button"
              disabled={!canCreate}
              onClick={() => canCreate && setIsAddModalOpen(true)}
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${
                canCreate
                  ? 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Office Location
            </button>
          </div>
        </div>

        {/* Office Locations Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:p-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      PT
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Area
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Area Detail
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pagedOfficeLocations.map((officeLocation) => (
                    <tr key={officeLocation.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {officeLocation.pt}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {officeLocation.area}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {officeLocation.areaDetail}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              setSelectedOfficeLocation(officeLocation)
                              setIsViewModalOpen(true)
                            }}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => {
                              if (!canEdit) return
                              setSelectedOfficeLocation(officeLocation)
                              setIsEditModalOpen(true)
                            }}
                            className={
                              canEdit ? 'text-yellow-600 hover:text-yellow-900' : 'text-gray-300 cursor-not-allowed'
                            }
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => canEdit && handleDeleteOfficeLocation(officeLocation.id)}
                            className={canEdit ? 'text-red-600 hover:text-red-900' : 'text-gray-300 cursor-not-allowed'}
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600">
          <span>
            Showing {filteredOfficeLocations.length === 0 ? 0 : (page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, filteredOfficeLocations.length)} of {filteredOfficeLocations.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="tabular-nums">
              Page {Math.min(page, totalPages)} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

        {/* Add Office Location Modal */}
        {isAddModalOpen && (
          <AddOfficeLocationModal
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
            onSave={handleAddOfficeLocation}
          />
        )}

        {/* Edit Office Location Modal */}
        {isEditModalOpen && selectedOfficeLocation && (
          <EditOfficeLocationModal
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedOfficeLocation(null)
            }}
            officeLocation={selectedOfficeLocation}
            onSave={handleEditOfficeLocation}
          />
        )}

        {/* View Office Location Modal */}
        {isViewModalOpen && selectedOfficeLocation && (
          <ViewOfficeLocationModal
            isOpen={isViewModalOpen}
            onClose={() => {
              setIsViewModalOpen(false)
              setSelectedOfficeLocation(null)
            }}
            officeLocation={selectedOfficeLocation}
          />
        )}

        <BulkUploadModal
          isOpen={isBulkUploadOpen}
          title="Bulk Upload Master Office Locations"
          templateName="master-office-locations-upload-template"
          onClose={() => {
            setIsBulkUploadOpen(false)
            loadOfficeLocations()
          }}
          onDownloadTemplate={(format) => MasterOfficeLocationAPI.downloadTemplate(format)}
          onUpload={(file) => MasterOfficeLocationAPI.bulkUpload(file)}
        />
      </div>
    </Layout>
  )
}

// Add Office Location Modal Component
interface AddOfficeLocationModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (officeLocation: Omit<OfficeLocation, 'id' | 'createdAt' | 'updatedAt'>) => void
}

function AddOfficeLocationModal({ isOpen, onClose, onSave }: AddOfficeLocationModalProps) {
  const [formData, setFormData] = useState({
    pt: '',
    area: '',
    areaDetail: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.pt && formData.area && formData.areaDetail) {
      onSave(formData)
      setFormData({ pt: '', area: '', areaDetail: '' })
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Office Location</h3>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PT
              </label>
              <input
                type="text"
                value={formData.pt}
                onChange={(e) => setFormData({ ...formData, pt: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Area
              </label>
              <input
                type="text"
                value={formData.area}
                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Area Detail
              </label>
              <input
                type="text"
                value={formData.areaDetail}
                onChange={(e) => setFormData({ ...formData, areaDetail: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Edit Office Location Modal Component
interface EditOfficeLocationModalProps {
  isOpen: boolean
  onClose: () => void
  officeLocation: OfficeLocation
  onSave: (officeLocation: OfficeLocation) => void
}

function EditOfficeLocationModal({ isOpen, onClose, officeLocation, onSave }: EditOfficeLocationModalProps) {
  const [formData, setFormData] = useState({
    pt: officeLocation.pt,
    area: officeLocation.area,
    areaDetail: officeLocation.areaDetail
  })

  useEffect(() => {
    setFormData({
      pt: officeLocation.pt,
      area: officeLocation.area,
      areaDetail: officeLocation.areaDetail
    })
  }, [officeLocation])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      ...officeLocation,
      ...formData
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Office Location</h3>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PT
              </label>
              <input
                type="text"
                value={formData.pt}
                onChange={(e) => setFormData({ ...formData, pt: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Area
              </label>
              <input
                type="text"
                value={formData.area}
                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Area Detail
              </label>
              <input
                type="text"
                value={formData.areaDetail}
                onChange={(e) => setFormData({ ...formData, areaDetail: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Update
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// View Office Location Modal Component
interface ViewOfficeLocationModalProps {
  isOpen: boolean
  onClose: () => void
  officeLocation: OfficeLocation
}

function ViewOfficeLocationModal({ isOpen, onClose, officeLocation }: ViewOfficeLocationModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Office Location Details</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">PT</label>
              <p className="mt-1 text-sm text-gray-900">{officeLocation.pt}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Area</label>
              <p className="mt-1 text-sm text-gray-900">{officeLocation.area}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Area Detail</label>
              <p className="mt-1 text-sm text-gray-900">{officeLocation.areaDetail}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Created At</label>
              <p className="mt-1 text-sm text-gray-900">
                {new Date(officeLocation.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Updated At</label>
              <p className="mt-1 text-sm text-gray-900">
                {new Date(officeLocation.updatedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
