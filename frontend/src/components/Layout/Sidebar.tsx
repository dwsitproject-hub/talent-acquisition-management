'use client'

import { Fragment, useEffect, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { MenuAccessAPI } from '@/lib/api'
import {
  HomeIcon,
  UsersIcon,
  EyeIcon,
  BriefcaseIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  CogIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  MapPinIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'

type NavChild = { name: string; href: string; icon: typeof UsersIcon }
type TopNavItem =
  | { kind: 'link'; name: string; href: string; icon: typeof HomeIcon }
  | { kind: 'candidateGroup'; name: string; children: NavChild[] }

const baseNavigation: TopNavItem[] = [
  { kind: 'link', name: 'Dashboard', href: '/', icon: HomeIcon },
  {
    kind: 'candidateGroup',
    name: 'Candidate',
    children: [
      { name: 'Candidates', href: '/candidates', icon: UsersIcon },
      { name: 'KIV', href: '/candidates/kiv', icon: EyeIcon },
    ],
  },
  { kind: 'link', name: 'Position', href: '/fptk', icon: BriefcaseIcon },
  { kind: 'link', name: 'Summary by Position', href: '/summary-by-position', icon: ChartBarIcon },
  { kind: 'link', name: 'Reports', href: '/reports', icon: ClipboardDocumentListIcon },
  { kind: 'link', name: 'User Management', href: '/team', icon: UserGroupIcon },
]

const masterNavigation = [
  { name: 'Master Division', href: '/masters/division', icon: BuildingOfficeIcon },
  { name: 'Master Office Location', href: '/masters/office-location', icon: MapPinIcon },
]

const settingsNavigation = [
  { name: 'Settings', href: '/settings', icon: CogIcon },
]

const adminNavigation = [
  { name: 'Audit Trail', href: '/audit-trail', icon: ShieldCheckIcon },
]

interface SidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  sidebarCollapsed?: boolean
  setSidebarCollapsed?: (collapsed: boolean) => void
}

function getDefaultNavRoles(href: string): string[] {
  const d: Record<string, string[]> = {
    '/team': ['SUPER_ADMIN', 'TA_HO'],
    '/audit-trail': ['SUPER_ADMIN'],
    '/candidates': [
      'SUPER_ADMIN', 'Management', 'Head of Division', 'HRBP', 'TA_HO', 'TA_SITE',
      'HIRING_MANAGER', 'INTERVIEWER',
    ],
    '/candidates/kiv': [
      'SUPER_ADMIN', 'Management', 'Head of Division', 'HRBP', 'TA_HO', 'TA_SITE',
      'HIRING_MANAGER', 'INTERVIEWER',
    ],
  }
  return d[href] || [
    'SUPER_ADMIN', 'Management', 'Head of Division', 'HRBP', 'TA_HO', 'TA_SITE',
    'HIRING_MANAGER', 'INTERVIEWER',
  ]
}

function PrimaryNavList({
  navigation,
  pathname,
  onLinkClick,
  collapsed = false,
}: {
  navigation: TopNavItem[]
  pathname: string
  onLinkClick?: () => void
  collapsed?: boolean
}) {
  const subActive = (href: string) =>
    href === '/candidates' ? pathname === '/candidates' : pathname === href

  if (collapsed) {
    return (
      <>
        {navigation.map((item) =>
          item.kind === 'link' ? (
            <li key={item.name}>
              <Link
                href={item.href}
                onClick={onLinkClick}
                title={item.name}
                className={cn(
                  pathname === item.href
                    ? 'bg-gray-50 text-indigo-600'
                    : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50',
                  'flex justify-center rounded-md p-2'
                )}
              >
                <item.icon
                  className={cn(
                    pathname === item.href ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-600',
                    'h-6 w-6 shrink-0'
                  )}
                  aria-hidden="true"
                />
                <span className="sr-only">{item.name}</span>
              </Link>
            </li>
          ) : (
            item.children.map((ch) => (
              <li key={ch.href}>
                <Link
                  data-tour={ch.href === '/candidates/kiv' ? 'nav-kiv' : undefined}
                  href={ch.href}
                  onClick={onLinkClick}
                  title={ch.name}
                  className={cn(
                    subActive(ch.href)
                      ? 'bg-gray-50 text-indigo-600'
                      : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50',
                    'flex justify-center rounded-md p-2'
                  )}
                >
                  <ch.icon
                    className={cn(
                      subActive(ch.href) ? 'text-indigo-600' : 'text-gray-400',
                      'h-5 w-5 shrink-0'
                    )}
                    aria-hidden="true"
                  />
                  <span className="sr-only">{ch.name}</span>
                </Link>
              </li>
            ))
          )
        )}
      </>
    )
  }

  return (
    <>
      {navigation.map((item) =>
        item.kind === 'link' ? (
          <li key={item.name}>
            <Link
              href={item.href}
              onClick={onLinkClick}
              className={cn(
                pathname === item.href
                  ? 'bg-gray-50 text-indigo-600'
                  : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50',
                'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
              )}
            >
              <item.icon
                className={cn(
                  pathname === item.href ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-600',
                  'h-6 w-6 shrink-0'
                )}
                aria-hidden="true"
              />
              {item.name}
            </Link>
          </li>
        ) : (
          <li key={item.name} className="space-y-1">
            <div className="px-2 text-xs font-semibold leading-6 text-gray-400 uppercase tracking-wider">
              {item.name}
            </div>
            <ul className="ml-1 space-y-1 border-l-2 border-gray-100 pl-2">
              {item.children.map((ch) => (
                <li key={ch.href}>
                  <Link
                    data-tour={ch.href === '/candidates/kiv' ? 'nav-kiv' : undefined}
                    href={ch.href}
                    onClick={onLinkClick}
                    className={cn(
                      subActive(ch.href)
                        ? 'bg-gray-50 text-indigo-600'
                        : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50',
                      'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                    )}
                  >
                    <ch.icon
                      className={cn(
                        subActive(ch.href) ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-600',
                        'h-5 w-5 shrink-0'
                      )}
                      aria-hidden="true"
                    />
                    {ch.name}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        )
      )}
    </>
  )
}

function mapEnumToRole(role: string): string {
  if (!role) return role
  const roleMap: Record<string, string> = {
    'SUPER_ADMIN': 'SUPER_ADMIN',
    'CHRO': 'Management',
    'DEPARTMENT_HEAD': 'Head of Division',
    'HRBP': 'HRBP',
      'TA_SITE': 'TA_SITE',
    'TA_HO': 'TA_HO',
    'HIRING_MANAGER': 'HIRING_MANAGER',
    'INTERVIEWER': 'INTERVIEWER',
    'CANDIDATE': 'CANDIDATE',
  }
  return roleMap[role] || role
}

export default function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  sidebarCollapsed = false,
  setSidebarCollapsed,
}: SidebarProps) {
  const pathname = usePathname()
  const { user, isAuthenticated } = useAuth()
  const backendRole = (user as any)?.role?.name || (user as any)?.role || 'TA_HO'
  const roleName = mapEnumToRole(backendRole)

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
      setMenuAccess({})
      setLoading(false)
    }
  }, [user, isAuthenticated])

  const isVisible = (href: string, defaultRoles: string[]) => {
    if (loading) return false
    const cfg = menuAccess[href]?.visibleRoles as string[] | undefined
    const roles = cfg && cfg.length ? cfg : defaultRoles
    return roles.includes(roleName)
  }

  const navigation: TopNavItem[] = baseNavigation
    .map((item) => {
      if (item.kind === 'link') {
        return isVisible(item.href, getDefaultNavRoles(item.href)) ? item : null
      }
      const children = item.children.filter((ch) => isVisible(ch.href, getDefaultNavRoles(ch.href)))
      if (children.length === 0) return null
      return { kind: 'candidateGroup' as const, name: item.name, children }
    })
    .filter((x): x is TopNavItem => x !== null)

  const filteredMasterNavigation = masterNavigation.filter(item => {
    const defaults: Record<string, string[]> = {
      '/masters/division': ['SUPER_ADMIN', 'TA_HO'],
      '/masters/office-location': ['SUPER_ADMIN', 'TA_HO'],
    }
    const defaultRoles = defaults[item.href] || ['SUPER_ADMIN', 'TA_HO']
    return isVisible(item.href, defaultRoles)
  })

  const filteredAdminNavigation = adminNavigation.filter((item) =>
    isVisible(item.href, getDefaultNavRoles(item.href))
  )

  const navPx = sidebarCollapsed ? 'px-2' : 'px-6'
  const listMx = sidebarCollapsed ? '' : '-mx-2'

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
                  <nav className="flex flex-1 flex-col" aria-busy={loading}>
                    <ul role="list" className="flex flex-1 flex-col gap-y-7">
                      <li>
                        <ul role="list" className="-mx-2 space-y-1">
                          {loading ? (
                            <li className="space-y-2 px-2" aria-hidden="true">
                              {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
                              ))}
                            </li>
                          ) : (
                            <PrimaryNavList
                              navigation={navigation}
                              pathname={pathname}
                              onLinkClick={() => setSidebarOpen(false)}
                            />
                          )}
                        </ul>
                      </li>
                      {!loading && filteredMasterNavigation.length > 0 && (
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
                                      pathname === item.href ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-600',
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
                      {!loading && filteredAdminNavigation.length > 0 && (
                        <li>
                          <div className="text-xs font-semibold leading-6 text-gray-400 uppercase tracking-wider">
                            Administration
                          </div>
                          <ul role="list" className="-mx-2 mt-2 space-y-1">
                            {filteredAdminNavigation.map((item) => (
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
                                      pathname === item.href ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-600',
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
                      {!loading && (
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
                                      pathname === item.href ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-600',
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
                    </ul>
                  </nav>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Static sidebar for desktop */}
      <div
        className={cn(
          'hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:flex-col transition-all duration-300 overflow-hidden',
          sidebarCollapsed ? 'lg:w-16' : 'lg:w-72'
        )}
      >
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white pb-4">
          {/* Logo */}
          <div
            className={cn(
              'flex h-16 shrink-0 items-center border-b border-gray-100',
              sidebarCollapsed ? 'justify-center px-2' : 'px-6'
            )}
          >
            {sidebarCollapsed ? (
              <span className="text-lg font-bold text-indigo-600">K</span>
            ) : (
              <h1 className="text-xl font-bold text-gray-900">KPN TAS</h1>
            )}
          </div>

          {/* Nav */}
          <nav className={cn('flex flex-1 flex-col', navPx)} aria-busy={loading}>
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className={cn('space-y-1', listMx)}>
                  {loading ? (
                    <li className="space-y-2 px-2" aria-hidden="true">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
                      ))}
                    </li>
                  ) : (
                    <PrimaryNavList
                      navigation={navigation}
                      pathname={pathname}
                      collapsed={sidebarCollapsed}
                    />
                  )}
                </ul>
              </li>

              {!loading && filteredMasterNavigation.length > 0 && (
                <li>
                  {!sidebarCollapsed && (
                    <div className="text-xs font-semibold leading-6 text-gray-400 uppercase tracking-wider">
                      Master Data
                    </div>
                  )}
                  <ul role="list" className={cn('mt-2 space-y-1', listMx)}>
                    {filteredMasterNavigation.map((item) => (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          title={sidebarCollapsed ? item.name : undefined}
                          className={cn(
                            pathname === item.href
                              ? 'bg-gray-50 text-indigo-600'
                              : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50',
                            sidebarCollapsed
                              ? 'flex justify-center rounded-md p-2'
                              : 'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                          )}
                        >
                          <item.icon
                            className={cn(
                              pathname === item.href ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-600',
                              'h-6 w-6 shrink-0'
                            )}
                            aria-hidden="true"
                          />
                          {!sidebarCollapsed && item.name}
                          {sidebarCollapsed && <span className="sr-only">{item.name}</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              )}

              {!loading && filteredAdminNavigation.length > 0 && (
                <li>
                  {!sidebarCollapsed && (
                    <div className="text-xs font-semibold leading-6 text-gray-400 uppercase tracking-wider">
                      Administration
                    </div>
                  )}
                  <ul role="list" className={cn('mt-2 space-y-1', listMx)}>
                    {filteredAdminNavigation.map((item) => (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          title={sidebarCollapsed ? item.name : undefined}
                          className={cn(
                            pathname === item.href
                              ? 'bg-gray-50 text-indigo-600'
                              : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50',
                            sidebarCollapsed
                              ? 'flex justify-center rounded-md p-2'
                              : 'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                          )}
                        >
                          <item.icon
                            className={cn(
                              pathname === item.href ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-600',
                              'h-6 w-6 shrink-0'
                            )}
                            aria-hidden="true"
                          />
                          {!sidebarCollapsed && item.name}
                          {sidebarCollapsed && <span className="sr-only">{item.name}</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              )}

              {!loading && (
                <li>
                  <ul role="list" className={cn('space-y-1', listMx)}>
                    {settingsNavigation.map((item) => (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          title={sidebarCollapsed ? item.name : undefined}
                          className={cn(
                            pathname === item.href
                              ? 'bg-gray-50 text-indigo-600'
                              : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50',
                            sidebarCollapsed
                              ? 'flex justify-center rounded-md p-2'
                              : 'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                          )}
                        >
                          <item.icon
                            className={cn(
                              pathname === item.href ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-600',
                              'h-6 w-6 shrink-0'
                            )}
                            aria-hidden="true"
                          />
                          {!sidebarCollapsed && item.name}
                          {sidebarCollapsed && <span className="sr-only">{item.name}</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              )}
            </ul>
          </nav>

          {/* Collapse / Expand toggle */}
          <div className={cn('border-t border-gray-100 pt-2 pb-1', navPx)}>
            <button
              type="button"
              onClick={() => setSidebarCollapsed?.(!sidebarCollapsed)}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={cn(
                'flex items-center gap-2 rounded-md p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 w-full transition-colors',
                sidebarCollapsed ? 'justify-center' : ''
              )}
            >
              {sidebarCollapsed ? (
                <ChevronRightIcon className="h-5 w-5 shrink-0" />
              ) : (
                <>
                  <ChevronLeftIcon className="h-5 w-5 shrink-0" />
                  <span className="text-xs font-medium">Collapse</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
