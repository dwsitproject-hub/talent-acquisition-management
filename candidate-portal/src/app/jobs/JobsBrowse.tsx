'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Loader2, MapPin, Search } from 'lucide-react'
import { fetchPublishedJobs, type PublishedJob } from '@/lib/api'
import NavBar from '@/components/NavBar'

const PAGE_SIZES = [10, 20, 50, 100] as const

function parsePositiveInt(value: string | null, fallback: number): number {
  const n = parseInt(value || '', 10)
  return Number.isFinite(n) && n >= 1 ? n : fallback
}

function clampPageSize(n: number): (typeof PAGE_SIZES)[number] {
  if (PAGE_SIZES.includes(n as (typeof PAGE_SIZES)[number])) {
    return n as (typeof PAGE_SIZES)[number]
  }
  return 20
}

function jobTitle(job: PublishedJob): string {
  return (job.positionTitle || job.position || 'Open position').trim() || 'Open position'
}

export default function JobsBrowse() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const page = parsePositiveInt(searchParams.get('page'), 1)
  const limit = clampPageSize(parsePositiveInt(searchParams.get('limit'), 20))
  const searchQ = searchParams.get('search')?.trim() ?? ''
  const departmentQ = searchParams.get('department')?.trim() ?? ''
  const locationQ = searchParams.get('location')?.trim() ?? ''
  const employmentQ = searchParams.get('employmentType')?.trim() ?? ''

  const [searchDraft, setSearchDraft] = useState(searchQ)
  const [departmentDraft, setDepartmentDraft] = useState(departmentQ)
  const [locationDraft, setLocationDraft] = useState(locationQ)
  const [employmentDraft, setEmploymentDraft] = useState(employmentQ)

  useEffect(() => {
    setSearchDraft(searchQ)
    setDepartmentDraft(departmentQ)
    setLocationDraft(locationQ)
    setEmploymentDraft(employmentQ)
  }, [searchQ, departmentQ, locationQ, employmentQ])

  const setQuery = useCallback(
    (updates: Record<string, string | undefined | null>) => {
      const p = new URLSearchParams(searchParams.toString())
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') {
          p.delete(key)
        } else {
          p.set(key, value)
        }
      })
      const qs = p.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const queryKey = useMemo(
    () => ['published-jobs', page, limit, searchQ, departmentQ, locationQ, employmentQ] as const,
    [page, limit, searchQ, departmentQ, locationQ, employmentQ]
  )

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: () =>
      fetchPublishedJobs({
        page,
        limit,
        search: searchQ || undefined,
        department: departmentQ || undefined,
        location: locationQ || undefined,
        employmentType: employmentQ || undefined,
      }),
  })

  const jobs = data?.data ?? []
  const pagination = data?.pagination
  const total = pagination?.total ?? 0
  const totalPages =
    total === 0 ? 0 : Math.max(1, pagination?.totalPages ?? Math.ceil(total / limit))

  useEffect(() => {
    if (!pagination || total === 0) return
    const tp = pagination.totalPages
    if (tp >= 1 && page > tp) {
      setQuery({ page: String(tp) })
    }
  }, [page, pagination?.totalPages, pagination?.total, setQuery, total])

  const applyFilters = () => {
    setQuery({
      search: searchDraft.trim() || null,
      department: departmentDraft.trim() || null,
      location: locationDraft.trim() || null,
      employmentType: employmentDraft.trim() || null,
      page: '1',
    })
  }

  const goToPage = (next: number) => {
    if (totalPages < 1) return
    const clamped = Math.min(Math.max(1, next), totalPages)
    setQuery({ page: String(clamped) })
  }

  const onLimitChange = (nextLimit: string) => {
    const n = clampPageSize(parseInt(nextLimit, 10))
    setQuery({ limit: String(n), page: '1' })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <NavBar />

      <main className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Open positions</h1>
          <p className="mt-2 text-gray-600 text-sm sm:text-base">
            Published roles from our talent team. Use search and filters, then choose how many rows to show per page.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 mb-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="lg:col-span-2">
              <label htmlFor="job-search" className="block text-xs font-medium text-gray-500 mb-1">
                Search title or description
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden />
                <input
                  id="job-search"
                  type="search"
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                  placeholder="e.g. engineer, analyst…"
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            <div>
              <label htmlFor="job-dept" className="block text-xs font-medium text-gray-500 mb-1">
                Department
              </label>
              <input
                id="job-dept"
                value={departmentDraft}
                onChange={(e) => setDepartmentDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Filter…"
              />
            </div>
            <div>
              <label htmlFor="job-loc" className="block text-xs font-medium text-gray-500 mb-1">
                Location
              </label>
              <input
                id="job-loc"
                value={locationDraft}
                onChange={(e) => setLocationDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="City or site…"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:justify-between">
            <div className="w-full sm:w-56">
              <label htmlFor="job-emp" className="block text-xs font-medium text-gray-500 mb-1">
                Employment type
              </label>
              <select
                id="job-emp"
                value={employmentDraft}
                onChange={(e) => setEmploymentDraft(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
              >
                <option value="">Any</option>
                <option value="Permanent">Permanent</option>
                <option value="Contract">Contract</option>
                <option value="Internship">Internship</option>
                <option value="Part Time">Part Time</option>
                <option value="Full Time Employee">Full Time Employee</option>
              </select>
            </div>
            <div className="flex gap-2 sm:ml-auto">
              <button
                type="button"
                onClick={applyFilters}
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
              >
                Apply filters
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchDraft('')
                  setDepartmentDraft('')
                  setLocationDraft('')
                  setEmploymentDraft('')
                  setQuery({
                    search: null,
                    department: null,
                    location: null,
                    employmentType: null,
                    page: '1',
                  })
                }}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <p className="text-sm text-gray-600">
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Loading positions…
              </span>
            ) : (
              <>
                Showing{' '}
                <span className="font-medium text-gray-900">
                  {total === 0 ? 0 : (page - 1) * limit + 1}–{Math.min(page * limit, total)}
                </span>{' '}
                of <span className="font-medium text-gray-900">{total}</span>{' '}
                {total === 1 ? 'result' : 'results'}
                {isFetching && !isLoading ? (
                  <Loader2 className="inline h-3.5 w-3.5 animate-spin ml-1 text-gray-400" aria-label="Refreshing" />
                ) : null}
              </>
            )}
          </p>
          <div className="flex items-center gap-2">
            <label htmlFor="page-size" className="text-sm text-gray-600 whitespace-nowrap">
              Rows per page
            </label>
            <select
              id="page-size"
              value={limit}
              onChange={(e) => onLimitChange(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isError ? (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-6 text-center">
            <p className="text-red-800 text-sm font-medium">Could not load job list</p>
            <p className="text-red-700/90 text-xs mt-1">
              {(error as Error)?.message || 'Check that the API is running and NEXT_PUBLIC_API_URL is set if needed.'}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-4 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-red-700 text-white text-sm font-medium hover:bg-red-800"
            >
              Try again
            </button>
          </div>
        ) : !isLoading && jobs.length === 0 ? (
          <div className="rounded-xl border border-gray-100 bg-white px-6 py-12 text-center text-gray-600">
            <p className="font-medium text-gray-900">No published positions match your filters.</p>
            <p className="text-sm mt-2">Try clearing filters or check back later.</p>
            <Link href="/" className="inline-block mt-6 text-primary-600 font-medium hover:underline">
              ← Back to home
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {jobs.map((job) => (
              <li
                key={job.id}
                className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5 shadow-sm hover:border-primary-200 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{jobTitle(job)}</h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {job.fptkNumber ? `${job.fptkNumber} · ` : ''}
                      {job.department || 'Department TBD'}
                      {job.level ? ` · ${job.level}` : ''}
                    </p>
                  </div>
                  {job.employmentType ? (
                    <span className="self-start text-xs font-medium uppercase tracking-wide text-primary-700 bg-primary-50 px-2 py-1 rounded">
                      {job.employmentType}
                    </span>
                  ) : null}
                </div>
                {job.location ? (
                  <p className="mt-2 text-sm text-gray-600 inline-flex items-center gap-1">
                    <MapPin className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                    {job.location}
                  </p>
                ) : null}
                {job.jobDescription ? (
                  <p className="mt-3 text-sm text-gray-600 line-clamp-3">{job.jobDescription}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {total > 0 && totalPages > 0 && (
          <nav
            className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100 pt-6"
            aria-label="Pagination"
          >
            <p className="text-sm text-gray-600 order-2 sm:order-1">
              Page <span className="font-medium text-gray-900">{Math.min(page, totalPages)}</span> of{' '}
              <span className="font-medium text-gray-900">{totalPages}</span>
            </p>
            <div className="flex items-center gap-2 order-1 sm:order-2">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1 || isLoading}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Previous
              </button>
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages || isLoading}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
              >
                Next
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </nav>
        )}

        <div className="mt-10 text-center">
          <Link href="/" className="text-primary-600 font-medium hover:underline text-sm">
            ← Back to home
          </Link>
        </div>
      </main>
    </div>
  )
}
