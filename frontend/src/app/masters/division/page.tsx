'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout/Layout'
import { PlusIcon, PencilIcon, TrashIcon, EyeIcon } from '@heroicons/react/24/outline'
import { MasterDivisionAPI, AdminUsersAPI, MenuAccessAPI } from '@/lib/api'

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

interface Division {
  id: string
  divisionName: string
  sectionName: string
  headOfDivisionName: string
  hiringManagerName: string
  createdAt: string
  updatedAt: string
}

/** Users with Hiring Manager or Head of Division role (deduped by id) for master division dropdowns. */
async function loadHiringManagerSelectOptions(): Promise<Array<{ firstName: string; lastName: string }>> {
  try {
    const [hm, hod] = await Promise.all([
      AdminUsersAPI.list('', 'HIRING_MANAGER'),
      AdminUsersAPI.list('', 'Head of Division'),
    ])
    const byId = new Map<string, { firstName: string; lastName: string }>()
    for (const u of [...(hm || []), ...(hod || [])]) {
      if (!u?.id) continue
      if (!byId.has(u.id)) {
        byId.set(u.id, { firstName: u.firstName || '', lastName: u.lastName || '' })
      }
    }
    return Array.from(byId.values()).sort((a, b) =>
      `${a.firstName} ${a.lastName}`.trim().localeCompare(`${b.firstName} ${b.lastName}`.trim())
    )
  } catch {
    return []
  }
}

export default function MasterDivisionPage() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()
  const [divisions, setDivisions] = useState<Division[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<10 | 50 | 100>(50)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [selectedDivision, setSelectedDivision] = useState<Division | null>(null)
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

  const loadDivisions = async (search?: string) => {
    try {
      setLoading(true)
      const data = await MasterDivisionAPI.getAll(search || searchTerm)
      setDivisions(
        (data || []).map((d: Division) => ({
          ...d,
          hiringManagerName: d.hiringManagerName ?? '',
        }))
      )
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
      setDivisions((prev) => [
        ...prev,
        { ...newDivision, hiringManagerName: newDivision.hiringManagerName ?? '' },
      ])
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
        hiringManagerName: divisionData.hiringManagerName,
      })
      setDivisions((prev) =>
        prev.map((div) =>
          div.id === divisionData.id
            ? { ...updatedDivision, hiringManagerName: updatedDivision.hiringManagerName ?? '' }
            : div
        )
      )
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

  useEffect(() => {
    setPage(1)
  }, [searchTerm, pageSize])

  const filteredDivisions = divisions
  const totalPages = Math.max(1, Math.ceil(filteredDivisions.length / pageSize))
  const pagedDivisions = useMemo(() => {
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * pageSize
    return filteredDivisions.slice(start, start + pageSize)
  }, [filteredDivisions, page, pageSize, totalPages])

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
  const cfg = menuAccess['/masters/division'] || {}
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
  const perms = cfg.permissions || { view: visibleRoles, create: ['SUPER_ADMIN','TA_TEAM'], edit: ['SUPER_ADMIN','TA_TEAM'] }
  const canCreate = (perms.create || []).includes(roleName) || (perms.create || []).includes('*')
  const canEdit = (perms.edit || []).includes(roleName) || (perms.edit || []).includes('*')

  return (
    <Layout>
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Master Division</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage division information including division name, section name, hiring manager, and head of division
          </p>
        </div>

        {/* Search and Add Button */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex-1 max-w-lg">
            <input
              type="text"
              placeholder="Division, section, hiring manager, or head of division…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search master divisions"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">
              Matches division name, section name, hiring manager name, or head of division name (partial match, not case-sensitive).
            </p>
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
              disabled={!canCreate}
              onClick={() => canCreate && setIsBulkUploadOpen(true)}
              className={`inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md ${canCreate ? 'border-gray-300 text-gray-900 hover:bg-gray-50' : 'border-gray-200 text-gray-400 cursor-not-allowed'}`}
            >
              Bulk Upload
            </button>
            <button
              disabled={!canCreate}
              onClick={() => canCreate && setIsAddModalOpen(true)}
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${canCreate ? 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500' : 'bg-gray-300 cursor-not-allowed'}`}
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Division
            </button>
          </div>
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
                      Hiring Manager
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
                  {pagedDivisions.map((division) => (
                    <tr key={division.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {division.divisionName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {division.sectionName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {division.hiringManagerName?.trim() ? division.hiringManagerName : '—'}
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

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600">
          <span>
            Showing {filteredDivisions.length === 0 ? 0 : (page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, filteredDivisions.length)} of {filteredDivisions.length}
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

        <BulkUploadModal
          isOpen={isBulkUploadOpen}
          title="Bulk Upload Master Divisions"
          templateName="master-divisions-upload-template"
          onClose={() => {
            setIsBulkUploadOpen(false)
            loadDivisions()
          }}
          onDownloadTemplate={(format) => MasterDivisionAPI.downloadTemplate(format)}
          onUpload={(file) => MasterDivisionAPI.bulkUpload(file)}
        />
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
    headOfDivisionName: '',
    hiringManagerName: '',
  })
  const [headOfDivisionOptions, setHeadOfDivisionOptions] = useState<Array<{firstName: string, lastName: string}>>([])
  const [hiringManagerOptions, setHiringManagerOptions] = useState<Array<{ firstName: string; lastName: string }>>([])

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
      const loadHm = async () => {
        try {
          setHiringManagerOptions(await loadHiringManagerSelectOptions())
        } catch (error) {
          console.error('Error loading hiring manager options:', error)
        }
      }
      loadHeadOfDivisionOptions()
      loadHm()
    }
  }, [isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.divisionName && formData.sectionName && formData.headOfDivisionName) {
      onSave(formData)
      setFormData({ divisionName: '', sectionName: '', headOfDivisionName: '', hiringManagerName: '' })
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
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hiring Manager <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <p className="text-xs text-gray-500 mb-2">Users with Hiring Manager or Head of Division role</p>
              <select
                value={formData.hiringManagerName}
                onChange={(e) => setFormData({ ...formData, hiringManagerName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">None</option>
                {hiringManagerOptions.map((user, index) => {
                  const fullName = `${user.firstName} ${user.lastName}`.trim()
                  return (
                    <option key={index} value={fullName}>
                      {fullName}
                    </option>
                  )
                })}
              </select>
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
    headOfDivisionName: division.headOfDivisionName,
    hiringManagerName: division.hiringManagerName ?? '',
  })
  const [headOfDivisionOptions, setHeadOfDivisionOptions] = useState<Array<{firstName: string, lastName: string}>>([])
  const [hiringManagerOptions, setHiringManagerOptions] = useState<Array<{ firstName: string; lastName: string }>>([])

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
      const loadHm = async () => {
        try {
          setHiringManagerOptions(await loadHiringManagerSelectOptions())
        } catch (error) {
          console.error('Error loading hiring manager options:', error)
        }
      }
      loadHeadOfDivisionOptions()
      loadHm()
    }
  }, [isOpen])

  useEffect(() => {
    setFormData({
      divisionName: division.divisionName,
      sectionName: division.sectionName,
      headOfDivisionName: division.headOfDivisionName,
      hiringManagerName: division.hiringManagerName ?? '',
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
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hiring Manager
              </label>
              <p className="text-xs text-gray-500 mb-2">Users with Hiring Manager or Head of Division role</p>
              <select
                value={formData.hiringManagerName}
                onChange={(e) => setFormData({ ...formData, hiringManagerName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">None / clear</option>
                {(() => {
                  const names = new Set(
                    hiringManagerOptions.map((u) => `${u.firstName} ${u.lastName}`.trim())
                  )
                  const current = (formData.hiringManagerName || '').trim()
                  const extra =
                    current && !names.has(current)
                      ? [{ firstName: current, lastName: '' }]
                      : []
                  return [...extra, ...hiringManagerOptions].map((user, index) => {
                    const fullName = `${user.firstName} ${user.lastName}`.trim()
                    return (
                      <option key={`${fullName}-${index}`} value={fullName}>
                        {fullName}
                      </option>
                    )
                  })
                })()}
              </select>
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
              <label className="block text-sm font-medium text-gray-700">Hiring Manager</label>
              <p className="mt-1 text-sm text-gray-900">
                {division.hiringManagerName?.trim() ? division.hiringManagerName : '—'}
              </p>
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
