'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout/Layout'
import { PlusIcon, PencilIcon, TrashIcon, EyeIcon } from '@heroicons/react/24/outline'
import { MasterOfficeLocationAPI } from '@/lib/api'

interface OfficeLocation {
  id: string
  pt: string
  area: string
  areaDetail: string
  createdAt: string
  updatedAt: string
}

export default function MasterOfficeLocationPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [officeLocations, setOfficeLocations] = useState<OfficeLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [selectedOfficeLocation, setSelectedOfficeLocation] = useState<OfficeLocation | null>(null)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router])

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

  const filteredOfficeLocations = officeLocations

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
          <h1 className="text-2xl font-bold text-gray-900">Master Office Location</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage office location information including area and area details
          </p>
        </div>

        {/* Search and Add Button */}
        <div className="mb-6 flex justify-between items-center">
          <div className="flex-1 max-w-lg">
            <input
              type="text"
              placeholder="Search office locations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="ml-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Add Office Location
          </button>
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
                  {filteredOfficeLocations.map((officeLocation) => (
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
                            onClick={() => {
                              setSelectedOfficeLocation(officeLocation)
                              setIsEditModalOpen(true)
                            }}
                            className="text-yellow-600 hover:text-yellow-900"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteOfficeLocation(officeLocation.id)}
                            className="text-red-600 hover:text-red-900"
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
