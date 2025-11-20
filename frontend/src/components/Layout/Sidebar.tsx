'use client'

import { Fragment, useEffect, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { MenuAccessAPI } from '@/lib/api'
import {
  HomeIcon,
  UsersIcon,
  BriefcaseIcon,
  ChartBarIcon,
  CogIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline'

const baseNavigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Candidates', href: '/candidates', icon: UsersIcon },
  { name: 'Position', href: '/fptk', icon: BriefcaseIcon },
  { name: 'Summary by Position', href: '/summary-by-position', icon: ChartBarIcon },
  { name: 'Reports', href: '/reports', icon: ChartBarIcon },
  { name: 'Team', href: '/team', icon: UserGroupIcon },
]

const masterNavigation = [
  { name: 'Master Division', href: '/masters/division', icon: BuildingOfficeIcon },
  { name: 'Master Office Location', href: '/masters/office-location', icon: MapPinIcon },
]

const settingsNavigation = [
  { name: 'Settings', href: '/settings', icon: CogIcon },
]

interface SidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

// Map backend enum values to frontend role names
function mapEnumToRole(role: string): string {
  if (!role) return role
  const roleMap: Record<string, string> = {
    'SUPER_ADMIN': 'SUPER_ADMIN',
    'CHRO': 'Management',
    'DEPARTMENT_HEAD': 'Head of Division',
    'HRBP': 'HRBP',
    'TA_TEAM': 'TA_TEAM',
    'HIRING_MANAGER': 'HIRING_MANAGER',
    'INTERVIEWER': 'INTERVIEWER',
    'CANDIDATE': 'CANDIDATE',
  }
  return roleMap[role] || role
}

export default function Sidebar({ sidebarOpen, setSidebarOpen }: SidebarProps) {
  const pathname = usePathname()
  const { user, isAuthenticated } = useAuth()
  const backendRole = (user as any)?.role?.name || (user as any)?.role || 'TA_TEAM'
  // Map backend enum to frontend role name for Menu Access Management
  const roleName = mapEnumToRole(backendRole)
  
  // Fetch menu access from API
  const [menuAccess, setMenuAccess] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadMenuAccess = async () => {
      try {
        const access = await MenuAccessAPI.get()
        setMenuAccess(access || {})
      } catch (error) {
        console.error('Error loading menu access:', error)
        setMenuAccess({})
      } finally {
        setLoading(false)
      }
    }

    if (user && isAuthenticated) {
      loadMenuAccess()
    } else {
      // Clear menu access when user logs out
      setMenuAccess({})
      setLoading(false)
    }
  }, [user, isAuthenticated])

  const isVisible = (href: string, defaultRoles: string[]) => {
    if (loading) return false // Don't show menus while loading
    const cfg = menuAccess[href]?.visibleRoles as string[] | undefined
    const roles = cfg && cfg.length ? cfg : defaultRoles
    return roles.includes(roleName)
  }
  const navigation = baseNavigation.filter(item => {
    // Defaults: Team only SUPER_ADMIN and TA_TEAM; others visible to all roles
    const defaults: Record<string, string[]> = {
      '/team': ['SUPER_ADMIN','TA_TEAM']
    }
    const defaultRoles = defaults[item.href] || ['SUPER_ADMIN','Management','Head of Division','HRBP','TA_TEAM','HIRING_MANAGER','INTERVIEWER']
    return isVisible(item.href, defaultRoles)
  })

  // Filter master navigation by role using Menu Access Management
  const filteredMasterNavigation = masterNavigation.filter(item => {
    // Defaults: Master Division and Master Office Location only SUPER_ADMIN and TA_TEAM
    const defaults: Record<string, string[]> = {
      '/masters/division': ['SUPER_ADMIN','TA_TEAM'],
      '/masters/office-location': ['SUPER_ADMIN','TA_TEAM'],
    }
    const defaultRoles = defaults[item.href] || ['SUPER_ADMIN','TA_TEAM']
    return isVisible(item.href, defaultRoles)
  })

  return (
    <>
      {/* Mobile sidebar */}
      <Transition.Root show={sidebarOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50 lg:hidden" onClose={setSidebarOpen}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-900/80" />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                <Transition.Child
                  as={Fragment}
                  enter="ease-in-out duration-300"
                  enterFrom="opacity-0"
                  enterTo="opacity-100"
                  leave="ease-in-out duration-300"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                    <button
                      type="button"
                      className="-m-2.5 p-2.5"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span className="sr-only">Close sidebar</span>
                      <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                    </button>
                  </div>
                </Transition.Child>
                <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pb-4">
                  <div className="flex h-16 shrink-0 items-center">
                    <h1 className="text-xl font-bold text-gray-900">KPN TAS</h1>
                  </div>
                  <nav className="flex flex-1 flex-col">
                    <ul role="list" className="flex flex-1 flex-col gap-y-7">
                      <li>
                        <ul role="list" className="-mx-2 space-y-1">
                          {navigation.map((item) => (
                            <li key={item.name}>
                              <Link
                                href={item.href}
                                className={cn(
                                  pathname === item.href
                                    ? 'bg-gray-50 text-indigo-600'
                                    : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50',
                                  'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                                )}
                              >
                                <item.icon
                                  className={cn(
                                    pathname === item.href
                                      ? 'text-indigo-600'
                                      : 'text-gray-400 group-hover:text-indigo-600',
                                    'h-6 w-6 shrink-0'
                                  )}
                                  aria-hidden="true"
                                />
                                {item.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </li>
                      {filteredMasterNavigation.length > 0 && (
                      <li>
                        <div className="text-xs font-semibold leading-6 text-gray-400 uppercase tracking-wider">
                          Master Data
                        </div>
                        <ul role="list" className="-mx-2 mt-2 space-y-1">
                          {filteredMasterNavigation.map((item) => (
                            <li key={item.name}>
                              <Link
                                href={item.href}
                                className={cn(
                                  pathname === item.href
                                    ? 'bg-gray-50 text-indigo-600'
                                    : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50',
                                  'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                                )}
                              >
                                <item.icon
                                  className={cn(
                                    pathname === item.href
                                      ? 'text-indigo-600'
                                      : 'text-gray-400 group-hover:text-indigo-600',
                                    'h-6 w-6 shrink-0'
                                  )}
                                  aria-hidden="true"
                                />
                                {item.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </li>
                      )}
                      <li>
                        <ul role="list" className="-mx-2 space-y-1">
                          {settingsNavigation.map((item) => (
                            <li key={item.name}>
                              <Link
                                href={item.href}
                                className={cn(
                                  pathname === item.href
                                    ? 'bg-gray-50 text-indigo-600'
                                    : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50',
                                  'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                                )}
                              >
                                <item.icon
                                  className={cn(
                                    pathname === item.href
                                      ? 'text-indigo-600'
                                      : 'text-gray-400 group-hover:text-indigo-600',
                                    'h-6 w-6 shrink-0'
                                  )}
                                  aria-hidden="true"
                                />
                                {item.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </li>
                    </ul>
                  </nav>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Static sidebar for desktop */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white px-6 pb-4">
          <div className="flex h-16 shrink-0 items-center">
            <h1 className="text-xl font-bold text-gray-900">KPN TAS</h1>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={cn(
                          pathname === item.href
                            ? 'bg-gray-50 text-indigo-600'
                            : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50',
                          'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                        )}
                      >
                        <item.icon
                          className={cn(
                            pathname === item.href
                              ? 'text-indigo-600'
                              : 'text-gray-400 group-hover:text-indigo-600',
                            'h-6 w-6 shrink-0'
                          )}
                          aria-hidden="true"
                        />
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
              {filteredMasterNavigation.length > 0 && (
              <li>
                <div className="text-xs font-semibold leading-6 text-gray-400 uppercase tracking-wider">
                  Master Data
                </div>
                <ul role="list" className="-mx-2 mt-2 space-y-1">
                  {filteredMasterNavigation.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={cn(
                          pathname === item.href
                            ? 'bg-gray-50 text-indigo-600'
                            : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50',
                          'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                        )}
                      >
                        <item.icon
                          className={cn(
                            pathname === item.href
                              ? 'text-indigo-600'
                              : 'text-gray-400 group-hover:text-indigo-600',
                            'h-6 w-6 shrink-0'
                          )}
                          aria-hidden="true"
                        />
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
              )}
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {settingsNavigation.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={cn(
                          pathname === item.href
                            ? 'bg-gray-50 text-indigo-600'
                            : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50',
                          'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                        )}
                      >
                        <item.icon
                          className={cn(
                            pathname === item.href
                              ? 'text-indigo-600'
                              : 'text-gray-400 group-hover:text-indigo-600',
                            'h-6 w-6 shrink-0'
                          )}
                          aria-hidden="true"
                        />
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </>
  )
}
