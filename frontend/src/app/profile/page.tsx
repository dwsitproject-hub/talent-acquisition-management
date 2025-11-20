'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout/Layout'
import { UserIcon, EnvelopeIcon, PhoneIcon, BriefcaseIcon } from '@heroicons/react/24/outline'

export default function ProfilePage() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: '',
    division: '',
    sectionName: ''
  })
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router])

  useEffect(() => {
    if (user) {
      // Access user properties safely, including optional ones that might exist in localStorage
      const userData = user as any
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: userData.phone || '',
        role: typeof user.role === 'string' ? user.role : user.role?.name || '',
        division: userData.division || '',
        sectionName: userData.sectionName || ''
      })
    }
  }, [user])

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

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // In a real app, this would call an API to update the user profile
      // For now, we'll just update localStorage if it's stored there (only in browser)
      if (typeof window !== 'undefined') {
        try {
          const teamMembers = JSON.parse(localStorage.getItem('teamMembers') || '[]')
          const updatedMembers = teamMembers.map((member: any) => {
            if (member.email === user?.email) {
              return {
                ...member,
                ...formData
              }
            }
            return member
          })
          localStorage.setItem('teamMembers', JSON.stringify(updatedMembers))
        } catch (error) {
          console.warn('Could not update team members in localStorage:', error)
        }
      }
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500))
      
      setIsEditing(false)
      alert('Profile updated successfully!')
    } catch (error) {
      console.error('Error updating profile:', error)
      alert('Failed to update profile. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (user) {
      const userData = user as any
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: userData.phone || '',
        role: typeof user.role === 'string' ? user.role : user.role?.name || '',
        division: userData.division || '',
        sectionName: userData.sectionName || ''
      })
    }
    setIsEditing(false)
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-5 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center">
                    <UserIcon className="h-8 w-8 text-indigo-600" />
                  </div>
                </div>
                <div className="ml-4">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {user?.firstName} {user?.lastName}
                  </h1>
                  <p className="text-sm text-gray-500">{user?.email}</p>
                </div>
              </div>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Edit Profile
                </button>
              )}
            </div>
          </div>

          <div className="px-6 py-5">
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Personal Information</h2>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    ) : (
                      <p className="text-sm text-gray-900">{formData.firstName || '—'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    ) : (
                      <p className="text-sm text-gray-900">{formData.lastName || '—'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                      <EnvelopeIcon className="h-4 w-4 mr-1 text-gray-400" />
                      Email
                    </label>
                    {isEditing ? (
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        disabled
                      />
                    ) : (
                      <p className="text-sm text-gray-900">{formData.email || '—'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                      <PhoneIcon className="h-4 w-4 mr-1 text-gray-400" />
                      Phone
                    </label>
                    {isEditing ? (
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    ) : (
                      <p className="text-sm text-gray-900">{formData.phone || '—'}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Work Information</h2>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                      <BriefcaseIcon className="h-4 w-4 mr-1 text-gray-400" />
                      Role
                    </label>
                    {isEditing ? (
                      <select
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        disabled
                      >
                        <option value="SUPER_ADMIN">Super Admin</option>
                        <option value="CHRO">CHRO</option>
                        <option value="DEPARTMENT_HEAD">Department Head</option>
                        <option value="HRBP">HRBP</option>
                        <option value="TA_TEAM">TA Team</option>
                        <option value="HIRING_MANAGER">Hiring Manager</option>
                        <option value="INTERVIEWER">Interviewer</option>
                      </select>
                    ) : (
                      <p className="text-sm text-gray-900">{formData.role || '—'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Division
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.division}
                        onChange={(e) => setFormData({ ...formData, division: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        disabled
                      />
                    ) : (
                      <p className="text-sm text-gray-900">{formData.division || '—'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Section Name
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.sectionName}
                        onChange={(e) => setFormData({ ...formData, sectionName: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        disabled
                      />
                    ) : (
                      <p className="text-sm text-gray-900">{formData.sectionName || '—'}</p>
                    )}
                  </div>
                </div>
              </div>

              {isEditing && (
                <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                  <button
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

