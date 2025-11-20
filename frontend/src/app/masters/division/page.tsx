'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout/Layout'
import { PlusIcon, PencilIcon, TrashIcon, EyeIcon } from '@heroicons/react/24/outline'
import { MasterDivisionAPI, AdminUsersAPI } from '@/lib/api'

interface Division {
  id: string
  divisionName: string
  sectionName: string
  headOfDivisionName: string
  createdAt: string
  updatedAt: string
}

export default function MasterDivisionPage() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()
  const [divisions, setDivisions] = useState<Division[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [selectedDivision, setSelectedDivision] = useState<Division | null>(null)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router])

  const loadDivisions = async (search?: string) => {
    try {
      setLoading(true)
      const data = await MasterDivisionAPI.getAll(search || searchTerm)
      setDivisions(data)
    } catch (error) {
      console.error('Error loading divisions:', error)
      alert('Failed to load divisions. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDivisions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAddDivision = async (divisionData: Omit<Division, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newDivision = await MasterDivisionAPI.create(divisionData)
      setDivisions(prev => [...prev, newDivision])
      setIsAddModalOpen(false)
    } catch (error: any) {
      console.error('Error adding division:', error)
      alert(error.response?.data?.message || 'Failed to add division. Please try again.')
    }
  }

  const handleEditDivision = async (divisionData: Division) => {
    try {
      const updatedDivision = await MasterDivisionAPI.update(divisionData.id, {
        divisionName: divisionData.divisionName,
        sectionName: divisionData.sectionName,
        headOfDivisionName: divisionData.headOfDivisionName,
      })
      setDivisions(prev => prev.map(div => div.id === divisionData.id ? updatedDivision : div))
      setIsEditModalOpen(false)
      setSelectedDivision(null)
    } catch (error: any) {
      console.error('Error updating division:', error)
      alert(error.response?.data?.message || 'Failed to update division. Please try again.')
    }
  }

  const handleDeleteDivision = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this division?')) {
      try {
        await MasterDivisionAPI.delete(id)
        setDivisions(prev => prev.filter(division => division.id !== id))
      } catch (error: any) {
        console.error('Error deleting division:', error)
        alert(error.response?.data?.message || 'Failed to delete division. Please try again.')
      }
    }
  }

  // Reload divisions when search term changes (with debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      loadDivisions(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const filteredDivisions = divisions

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

  // Access control
  const roleName = (user as any)?.role?.name || (user as any)?.role || 'TA_TEAM'
  const menuAccess = (() => { 
    if (typeof window === 'undefined') return {}
    try { 
      return JSON.parse(localStorage.getItem('menuAccess') || 'null') || {} 
    } catch { 
      return {} 
    } 
  })()
  const cfg = menuAccess['/masters/division'] || {}
  const visibleRoles: string[] = cfg.visibleRoles && cfg.visibleRoles.length ? cfg.visibleRoles : ['SUPER_ADMIN','TA_TEAM']
  if (!visibleRoles.includes(roleName)) {
    router.push('/')
    return null
  }
  const perms = cfg.permissions || { view: visibleRoles, create: ['SUPER_ADMIN','TA_TEAM'], edit: ['SUPER_ADMIN','TA_TEAM'] }
  const canCreate = (perms.create || []).includes(roleName) || (perms.create || []).includes('*')
  const canEdit = (perms.edit || []).includes(roleName) || (perms.edit || []).includes('*')

  return (
    <Layout>
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Master Division</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage division information including division name, section name, and head of division
          </p>
        </div>

        {/* Search and Add Button */}
        <div className="mb-6 flex justify-between items-center">
          <div className="flex-1 max-w-lg">
            <input
              type="text"
              placeholder="Search divisions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <button
            disabled={!canCreate}
            onClick={() => canCreate && setIsAddModalOpen(true)}
            className={`ml-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${canCreate ? 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500' : 'bg-gray-300 cursor-not-allowed'}`}
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Add Division
          </button>
        </div>

        {/* Divisions Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:p-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Division Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Section Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Head of Division
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredDivisions.map((division) => (
                    <tr key={division.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {division.divisionName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {division.sectionName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {division.headOfDivisionName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              setSelectedDivision(division)
                              setIsViewModalOpen(true)
                            }}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </button>
                          <button
                            disabled={!canEdit}
                            onClick={() => { if (canEdit) { setSelectedDivision(division); setIsEditModalOpen(true) } }}
                            className={`${canEdit ? 'text-yellow-600 hover:text-yellow-900' : 'text-gray-300 cursor-not-allowed'}`}
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          <button
                            disabled={!canEdit}
                            onClick={() => canEdit && handleDeleteDivision(division.id)}
                            className={`${canEdit ? 'text-red-600 hover:text-red-900' : 'text-gray-300 cursor-not-allowed'}`}
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

        {/* Add Division Modal */}
        {isAddModalOpen && (
          <AddDivisionModal
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
            onSave={handleAddDivision}
          />
        )}

        {/* Edit Division Modal */}
        {isEditModalOpen && selectedDivision && (
          <EditDivisionModal
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedDivision(null)
            }}
            division={selectedDivision}
            onSave={handleEditDivision}
          />
        )}

        {/* View Division Modal */}
        {isViewModalOpen && selectedDivision && (
          <ViewDivisionModal
            isOpen={isViewModalOpen}
            onClose={() => {
              setIsViewModalOpen(false)
              setSelectedDivision(null)
            }}
            division={selectedDivision}
          />
        )}
      </div>
    </Layout>
  )
}

// Add Division Modal Component
interface AddDivisionModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (division: Omit<Division, 'id' | 'createdAt' | 'updatedAt'>) => void
}

function AddDivisionModal({ isOpen, onClose, onSave }: AddDivisionModalProps) {
  const [formData, setFormData] = useState({
    divisionName: '',
    sectionName: '',
    headOfDivisionName: ''
  })
  const [headOfDivisionOptions, setHeadOfDivisionOptions] = useState<Array<{firstName: string, lastName: string}>>([])

  useEffect(() => {
    if (isOpen) {
      const loadHeadOfDivisionOptions = async () => {
        try {
          const users = await AdminUsersAPI.list('', 'Head of Division')
          setHeadOfDivisionOptions(users.map((u: any) => ({ firstName: u.firstName, lastName: u.lastName })))
        } catch (error) {
          console.error('Error loading head of division options:', error)
        }
      }
      loadHeadOfDivisionOptions()
    }
  }, [isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.divisionName && formData.sectionName && formData.headOfDivisionName) {
      onSave(formData)
      setFormData({ divisionName: '', sectionName: '', headOfDivisionName: '' })
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Division</h3>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Division Name
              </label>
              <input
                type="text"
                value={formData.divisionName}
                onChange={(e) => setFormData({ ...formData, divisionName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Section Name
              </label>
              <input
                type="text"
                value={formData.sectionName}
                onChange={(e) => setFormData({ ...formData, sectionName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Head of Division Name
              </label>
              <select
                value={formData.headOfDivisionName}
                onChange={(e) => setFormData({ ...formData, headOfDivisionName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              >
                <option value="">Select Head of Division</option>
                {headOfDivisionOptions.map((user, index) => {
                  const fullName = `${user.firstName} ${user.lastName}`.trim()
                  return (
                    <option key={index} value={fullName}>
                      {fullName}
                    </option>
                  )
                })}
              </select>
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

// Edit Division Modal Component
interface EditDivisionModalProps {
  isOpen: boolean
  onClose: () => void
  division: Division
  onSave: (division: Division) => void
}

function EditDivisionModal({ isOpen, onClose, division, onSave }: EditDivisionModalProps) {
  const [formData, setFormData] = useState({
    divisionName: division.divisionName,
    sectionName: division.sectionName,
    headOfDivisionName: division.headOfDivisionName
  })
  const [headOfDivisionOptions, setHeadOfDivisionOptions] = useState<Array<{firstName: string, lastName: string}>>([])

  useEffect(() => {
    if (isOpen) {
      const loadHeadOfDivisionOptions = async () => {
        try {
          const users = await AdminUsersAPI.list('', 'Head of Division')
          setHeadOfDivisionOptions(users.map((u: any) => ({ firstName: u.firstName, lastName: u.lastName })))
        } catch (error) {
          console.error('Error loading head of division options:', error)
        }
      }
      loadHeadOfDivisionOptions()
    }
  }, [isOpen])

  useEffect(() => {
    setFormData({
      divisionName: division.divisionName,
      sectionName: division.sectionName,
      headOfDivisionName: division.headOfDivisionName
    })
  }, [division])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      ...division,
      ...formData
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Division</h3>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Division Name
              </label>
              <input
                type="text"
                value={formData.divisionName}
                onChange={(e) => setFormData({ ...formData, divisionName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Section Name
              </label>
              <input
                type="text"
                value={formData.sectionName}
                onChange={(e) => setFormData({ ...formData, sectionName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Head of Division Name
              </label>
              <select
                value={formData.headOfDivisionName}
                onChange={(e) => setFormData({ ...formData, headOfDivisionName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              >
                <option value="">Select Head of Division</option>
                {headOfDivisionOptions.map((user, index) => {
                  const fullName = `${user.firstName} ${user.lastName}`.trim()
                  return (
                    <option key={index} value={fullName}>
                      {fullName}
                    </option>
                  )
                })}
              </select>
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

// View Division Modal Component
interface ViewDivisionModalProps {
  isOpen: boolean
  onClose: () => void
  division: Division
}

function ViewDivisionModal({ isOpen, onClose, division }: ViewDivisionModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Division Details</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Division Name</label>
              <p className="mt-1 text-sm text-gray-900">{division.divisionName}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Section Name</label>
              <p className="mt-1 text-sm text-gray-900">{division.sectionName}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Head of Division</label>
              <p className="mt-1 text-sm text-gray-900">{division.headOfDivisionName}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Created At</label>
              <p className="mt-1 text-sm text-gray-900">
                {new Date(division.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Updated At</label>
              <p className="mt-1 text-sm text-gray-900">
                {new Date(division.updatedAt).toLocaleDateString()}
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
