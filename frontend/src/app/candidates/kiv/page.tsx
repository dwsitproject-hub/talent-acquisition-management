'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Layout from '@/components/Layout/Layout'
import { MenuAccessAPI, ApplicationsAPI } from '@/lib/api'
import { mapApplicationStatusToUi } from '@/utils/applicationStatusUi'
import { EyeIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'

const mapEnumToRole = (role: string): string => {
  if (!role) return role
  const roleMap: Record<string, string> = {
    SUPER_ADMIN: 'SUPER_ADMIN',
    CHRO: 'Management',
    DEPARTMENT_HEAD: 'Head of Division',
    HRBP: 'HRBP',
    TA_SITE: 'TA_SITE',
    TA_HO: 'TA_HO',
    HIRING_MANAGER: 'HIRING_MANAGER',
    INTERVIEWER: 'INTERVIEWER',
    CANDIDATE: 'CANDIDATE',
  }
  return roleMap[role] || role
}

type KivRow = {
  applicationId: string
  candidateId: string
  name: string
  email: string
  position: string
  division: string
  statusUi: string
  appliedAt: string | null
}

export default function KivPage() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()
  const backendRole = (user as any)?.role?.name || (user as any)?.role || 'TA_HO'
  const roleName = mapEnumToRole(backendRole)

  const [rows, setRows] = useState<KivRow[]>([])
  const [loading, setLoading] = useState(true)
  const [menuAccess, setMenuAccess] = useState<Record<string, any>>({})
  const [menuAccessLoading, setMenuAccessLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [positionFilter, setPositionFilter] = useState('')
  const [divisionFilter, setDivisionFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<10 | 50 | 100>(50)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router])

  useEffect(() => {
    let m = true
    const run = async () => {
      if (!isAuthenticated || isLoading) return
      try {
        const access = await MenuAccessAPI.get()
        if (m) setMenuAccess(access || {})
      } catch {
        if (m) setMenuAccess({})
      } finally {
        if (m) setMenuAccessLoading(false)
      }
    }
    run()
    return () => {
      m = false
    }
  }, [isAuthenticated, isLoading])

  useEffect(() => {
    const delay = searchTerm ? 350 : 0
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), delay)
    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!isAuthenticated || isLoading) return
      setLoading(true)
      try {
        const merged: KivRow[] = []
        const limit = 100
        const maxPages = 20
        let currentPage = 1
        let totalPages = 1
        do {
          const res = await ApplicationsAPI.getAll(
            {
              status: 'KEEP_IN_VIEW',
              ...(debouncedSearch ? { search: debouncedSearch } : {}),
              ...(divisionFilter ? { department: divisionFilter } : {}),
            },
            { page: currentPage, limit }
          )
          if (cancelled) return
          const apps: any[] = (res as any).data || []
          totalPages = (res as any).pagination?.totalPages ?? 1
          for (const app of apps) {
            if ((app?.status || '').toString().toUpperCase() === 'HIRED') {
              continue
            }
            const c = app.candidate
            const u = c?.user
            const name =
              [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim() || '—'
            const email = (u?.email || '').trim() || '—'
            const f = app.fptk || {}
            const position = (f.positionTitle || f.position || '—').toString()
            const division = (f.department || f.division || '—').toString()
            merged.push({
              applicationId: app.id,
              candidateId: c?.id || app.candidateId,
              name,
              email,
              position,
              division,
              statusUi: mapApplicationStatusToUi(app.status),
              appliedAt: app.appliedAt || null,
            })
          }
          currentPage += 1
        } while (currentPage <= totalPages && currentPage <= maxPages && !cancelled)
        if (!cancelled) {
          merged.sort((a, b) => a.name.localeCompare(b.name) || a.position.localeCompare(b.position))
          setRows(merged)
        }
      } catch (e) {
        console.error('KIV list load', e)
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, isLoading, debouncedSearch, divisionFilter])

  const cfgKiv = menuAccess['/candidates/kiv'] || menuAccess['/candidates'] || {}
  const visibleRoles: string[] =
    cfgKiv.visibleRoles && cfgKiv.visibleRoles.length
      ? cfgKiv.visibleRoles
      : [
          'SUPER_ADMIN',
          'Management',
          'Head of Division',
          'HRBP',
          'TA_HO',
          'TA_SITE',
          'HIRING_MANAGER',
          'INTERVIEWER',
        ]

  const formatDate = (d: string | null) => {
    if (!d) return '—'
    try {
      return new Date(d).toLocaleString()
    } catch {
      return '—'
    }
  }

  const positionOptions = useMemo(() => {
    const set = new Set<string>()
    rows.forEach((row) => {
      const value = row.position.trim()
      if (value && value !== '—') set.add(value)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [rows])

  const divisionOptions = useMemo(() => {
    const set = new Set<string>()
    rows.forEach((row) => {
      const value = row.division.trim()
      if (value && value !== '—') set.add(value)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [rows])

  const filteredRows = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()
    return rows.filter((row) => {
      const matchSearch =
        !keyword ||
        row.name.toLowerCase().includes(keyword) ||
        row.email.toLowerCase().includes(keyword) ||
        row.position.toLowerCase().includes(keyword) ||
        row.division.toLowerCase().includes(keyword)
      const matchPosition = !positionFilter || row.position === positionFilter
      const matchDivision = !divisionFilter || row.division === divisionFilter
      return matchSearch && matchPosition && matchDivision
    })
  }, [rows, searchTerm, positionFilter, divisionFilter])

  const listMeta = useMemo(() => {
    const total = filteredRows.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * pageSize
    const end = start + pageSize
    return {
      total,
      totalPages,
      safePage,
      pagedRows: filteredRows.slice(start, end),
    }
  }, [filteredRows, page, pageSize])

  useEffect(() => {
    setPage(1)
  }, [searchTerm, positionFilter, divisionFilter, pageSize])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  if (menuAccessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600" />
      </div>
    )
  }

  if (!visibleRoles.includes(roleName)) {
    router.push('/')
    return null
  }

  return (
    <Layout>
      <div>
        <div className="sm:flex sm:items-center sm:justify-between" data-tour="kiv-header">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <EyeIcon className="h-8 w-8 text-sky-600" aria-hidden />
              KIV — Keep In View
            </h1>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-4" data-tour="kiv-filters">
          <div className="flex-1">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
              </div>
              <input
                type="text"
                className="block w-full rounded-md border-0 py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                placeholder="Search candidates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="sm:w-48">
            <select
              className="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
            >
              <option value="">All Positions</option>
              {positionOptions.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:w-48">
            <select
              className="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
              value={divisionFilter}
              onChange={(e) => setDivisionFilter(e.target.value)}
            >
              <option value="">All Divisions</option>
              {divisionOptions.map((division) => (
                <option key={division} value={division}>
                  {division}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <label className="text-sm text-gray-600 whitespace-nowrap">Rows per page</label>
            <select
              className="block rounded-md border-0 py-1.5 pl-3 pr-8 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value) as 10 | 50 | 100)}
            >
              <option value={10}>10</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div className="mt-8 flow-root" data-tour="kiv-table">
          <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            {loading ? (
              <p className="p-6 text-sm text-gray-500">Loading…</p>
            ) : listMeta.total === 0 ? (
              <p className="p-6 text-sm text-gray-500">No applications with Keep In View status right now.</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                      Candidate
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Email
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Position
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Division
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Status
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Applied
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6 text-right text-sm font-semibold text-gray-900">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {listMeta.pagedRows.map((row) => (
                    <tr key={row.applicationId}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                        {row.name}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-600">{row.email}</td>
                      <td className="px-3 py-4 text-sm text-gray-900">{row.position}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-600">{row.division}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-800">
                          {row.statusUi}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{formatDate(row.appliedAt)}</td>
                      <td className="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm sm:pr-6">
                        <Link
                          href={`/candidates?view=${encodeURIComponent(row.candidateId)}`}
                          className="text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          Open candidate
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600">
          <span>
            {listMeta.total === 0
              ? 'Showing 0 of 0'
              : `Showing ${(listMeta.safePage - 1) * pageSize + 1}–${Math.min(listMeta.safePage * pageSize, listMeta.total)} of ${listMeta.total}`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={listMeta.safePage <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="tabular-nums">
              Page {listMeta.safePage} / {listMeta.totalPages}
            </span>
            <button
              type="button"
              disabled={listMeta.safePage >= listMeta.totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
