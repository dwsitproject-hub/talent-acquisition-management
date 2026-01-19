'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout/Layout'
import api from '@/lib/api'
import { 
  UserIcon, 
  ShieldCheckIcon, 
  KeyIcon, 
  CircleStackIcon,
  GlobeAltIcon,
  DocumentTextIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline'

export default function SettingsPage() {
  const { isAuthenticated, isLoading, user, refreshUser } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('profile')

  const [profileFirstName, setProfileFirstName] = useState('')
  const [profileLastName, setProfileLastName] = useState('')
  const [profilePhoneNumber, setProfilePhoneNumber] = useState('')
  const [profileIsSubmitting, setProfileIsSubmitting] = useState(false)
  const [profileError, setProfileError] = useState<string>('')
  const [profileSuccess, setProfileSuccess] = useState<string>('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordIsSubmitting, setPasswordIsSubmitting] = useState(false)
  const [passwordError, setPasswordError] = useState<string>('')
  const [passwordSuccess, setPasswordSuccess] = useState<string>('')

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router])

  useEffect(() => {
    setProfileFirstName(user?.firstName || '')
    setProfileLastName(user?.lastName || '')
    setProfilePhoneNumber((user as any)?.phoneNumber || '')
  }, [user])

  const handleSaveProfile = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setProfileError('')
    setProfileSuccess('')

    if (!profileFirstName.trim() || !profileLastName.trim()) {
      setProfileError('First Name and Last Name are required.')
      return
    }

    setProfileIsSubmitting(true)
    try {
      await api.put('/auth/me', {
        firstName: profileFirstName.trim(),
        lastName: profileLastName.trim(),
        phoneNumber: profilePhoneNumber,
      })
      await refreshUser()
      setProfileSuccess('Profile updated successfully.')
    } catch (err: any) {
      setProfileError(err?.response?.data?.message || err?.message || 'Failed to update profile.')
    } finally {
      setProfileIsSubmitting(false)
    }
  }

  const handleChangePassword = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (!currentPassword.trim() || !newPassword.trim() || !confirmNewPassword.trim()) {
      setPasswordError('Please fill Current Password, New Password, and Confirm New Password.')
      return
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError('New Password and Confirm New Password do not match.')
      return
    }

    if (newPassword.length < 6) {
      setPasswordError('New Password must be at least 6 characters.')
      return
    }

    setPasswordIsSubmitting(true)
    try {
      await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
      })
      setPasswordSuccess('Password updated successfully.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
    } catch (err: any) {
      setPasswordError(err?.response?.data?.message || err?.message || 'Failed to update password.')
    } finally {
      setPasswordIsSubmitting(false)
    }
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

  const tabs = [
    { id: 'profile', name: 'Profile', icon: UserIcon },
    { id: 'security', name: 'Security', icon: ShieldCheckIcon },
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Profile Information</h3>
              <p className="mt-1 text-sm text-gray-500">
                Update your personal information and contact details.
              </p>
            </div>

            {(profileError || profileSuccess) && (
              <div>
                {profileError && (
                  <div className="rounded-md bg-red-50 p-4">
                    <div className="text-sm text-red-700">{profileError}</div>
                  </div>
                )}
                {profileSuccess && (
                  <div className="rounded-md bg-green-50 p-4">
                    <div className="text-sm text-green-700">{profileSuccess}</div>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSaveProfile}>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">First Name</label>
                <input
                  type="text"
                  value={profileFirstName}
                  onChange={(e) => setProfileFirstName(e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Last Name</label>
                <input
                  type="text"
                  value={profileLastName}
                  onChange={(e) => setProfileLastName(e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">Email cannot be changed.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <input
                  type="tel"
                  value={profilePhoneNumber}
                  onChange={(e) => setProfilePhoneNumber(e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={profileIsSubmitting}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {profileIsSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
            </form>
          </div>
        )

      case 'security':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Security Settings</h3>
              <p className="mt-1 text-sm text-gray-500">
                Manage your password and security preferences.
              </p>
            </div>
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Change Password</h4>

                {(passwordError || passwordSuccess) && (
                  <div className="mt-4">
                    {passwordError && (
                      <div className="rounded-md bg-red-50 p-4">
                        <div className="text-sm text-red-700">{passwordError}</div>
                      </div>
                    )}
                    {passwordSuccess && (
                      <div className="rounded-md bg-green-50 p-4">
                        <div className="text-sm text-green-700">{passwordSuccess}</div>
                      </div>
                    )}
                  </div>
                )}

                <form className="mt-4 space-y-4" onSubmit={handleChangePassword}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Current Password</label>
                    <div className="mt-1 relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="block w-full pr-10 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      >
                        {showCurrentPassword ? (
                          <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                        ) : (
                          <EyeIcon className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">New Password</label>
                    <div className="mt-1 relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="block w-full pr-10 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? (
                          <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                        ) : (
                          <EyeIcon className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                    <div className="mt-1 relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className="block w-full pr-10 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                        ) : (
                          <EyeIcon className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={passwordIsSubmitting}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {passwordIsSubmitting ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Layout>
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your account settings and preferences
          </p>
        </div>

        <div className="lg:grid lg:grid-cols-12 lg:gap-x-5">
          {/* Sidebar */}
          <aside className="py-6 px-2 sm:px-6 lg:py-0 lg:px-0 lg:col-span-3">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  } group border-l-4 px-3 py-2 flex items-center text-sm font-medium`}
                >
                  <tab.icon
                    className={`${
                      activeTab === tab.id ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500'
                    } mr-3 h-5 w-5`}
                  />
                  {tab.name}
                </button>
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <div className="space-y-6 sm:px-6 lg:px-0 lg:col-span-9">
            <div className="bg-white shadow sm:rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                {renderTabContent()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
