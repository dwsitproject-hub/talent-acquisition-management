'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { AuditLogAPI, type AuditLogEntry } from '@/lib/api'
import { MagnifyingGlassIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

const ACTION_OPTIONS = [
  'ALL',
  'CREATE',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'LOGOUT',
  'APPROVE',
  'REJECT',
  'EXPORT',
] as const

function mapEnumToRole(role: string): string {
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

function formatDateTime(value?: string) {
  if (!value) return '-'
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatUser(entry: AuditLogEntry) {
  if (!entry.user) return entry.userId || 'System'
  return `${entry.user.firstName} ${entry.user.lastName} (${entry.user.email})`
}

function getSummary(entry: AuditLogEntry) {
  const summary = entry.newValues?._summary
  return typeof summary === 'string' ? summary : `${entry.action} ${entry.entity}`
}

function actionBadgeClass(action: string) {
  switch (action) {
    case 'CREATE':
      return 'bg-green-100 text-green-800'
    case 'UPDATE':
      return 'bg-blue-100 text-blue-800'
    case 'DELETE':
      return 'bg-red-100 text-red-800'
    case 'LOGIN':
    case 'LOGOUT':
      return 'bg-purple-100 text-purple-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export default function AuditTrailPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  const backendRole = (user as { role?: { name?: string } | string })?.role
  const roleName =
    typeof backendRole === 'object' && backendRole?.name
      ? mapEnumToRole(backendRole.name)
      : mapEnumToRole((backendRole as string) || '')

  const [items, setItems] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState<(typeof ACTION_OPTIONS)[number]>('ALL')
  const [entityFilter, setEntityFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null)

  const isSuperAdmin = roleName === 'SUPER_ADMIN'

  const loadLogs = useCallback(async () => {
    if (!isSuperAdmin) return
    setLoading(true)
    try {
      const result = await AuditLogAPI.list({
        page,
        limit: 25,
        search: search.trim() || undefined,
        action: actionFilter === 'ALL' ? undefined : actionFilter,
        entity: entityFilter.trim() || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      })
      setItems(result.items)
      setTotalPages(result.pagination.totalPages)
      setTotal(result.pagination.total)
    } catch (error) {
      console.error('Failed to load audit logs:', error)
      setItems([])
      setTotalPages(1)
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [isSuperAdmin, page, search, actionFilter, entityFilter, fromDate, toDate])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router])

  useEffect(() => {
    if (!isLoading && isAuthenticated && !isSuperAdmin) {
      router.push('/')
    }
  }, [isLoading, isAuthenticated, isSuperAdmin, router])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  const entityOptions = useMemo(() => {
    const values = new Set(items.map((item) => item.entity))
    return Array.from(values).sort()
  }, [items])

  if (isLoading || !isAuthenticated || !isSuperAdmin) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-32 text-gray-500">
          Loading audit trail…
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Audit Trail</h1>
            <p className="mt-1 text-sm text-gray-500">
              Track data creation, updates, deletions, and authentication events.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadLogs()}
            disabled={loading}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            <ArrowPathIcon className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="relative xl:col-span-2">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                value={search}
                onChange={(e) => {
                  setPage(1)
                  setSearch(e.target.value)
                }}
                placeholder="Search user, entity, or entity ID"
                className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <select
              value={actionFilter}
              onChange={(e) => {
                setPage(1)
                setActionFilter(e.target.value as (typeof ACTION_OPTIONS)[number])
              }}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {ACTION_OPTIONS.map((action) => (
                <option key={action} value={action}>
                  {action === 'ALL' ? 'All actions' : action}
                </option>
              ))}
            </select>
            <input
              value={entityFilter}
              onChange={(e) => {
                setPage(1)
                setEntityFilter(e.target.value)
              }}
              list="audit-entity-options"
              placeholder="Entity (e.g. Candidate)"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <datalist id="audit-entity-options">
              {entityOptions.map((entity) => (
                <option key={entity} value={entity} />
              ))}
            </datalist>
            <div className="grid grid-cols-2 gap-2 xl:col-span-2">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setPage(1)
                  setFromDate(e.target.value)
                }}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setPage(1)
                  setToDate(e.target.value)
                }}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Summary</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Entity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Entity ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">IP</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500">
                      Loading audit logs…
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500">
                      No audit logs found.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                        {formatDateTime(item.createdAt)}
                      </td>
                      <td className="max-w-[16rem] truncate px-4 py-3 text-sm text-gray-700" title={formatUser(item)}>
                        {formatUser(item)}
                      </td>
                      <td className="max-w-[18rem] truncate px-4 py-3 text-sm text-gray-900" title={getSummary(item)}>
                        {getSummary(item)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${actionBadgeClass(item.action)}`}>
                          {item.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{item.entity}</td>
                      <td className="max-w-[12rem] truncate px-4 py-3 text-sm font-mono text-gray-600" title={item.entityId || ''}>
                        {item.entityId || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{item.ipAddress || '-'}</td>
                      <td className="px-4 py-3 text-right text-sm">
                        <button
                          type="button"
                          onClick={() => setSelectedLog(item)}
                          className="font-medium text-indigo-600 hover:text-indigo-800"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-3">
            <p className="text-sm text-gray-500">
              Showing {items.length} of {total} log entries
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {selectedLog && (
        <div className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Audit Log Details</h2>
                <p className="text-sm text-gray-500">{formatDateTime(selectedLog.createdAt)}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                Close
              </button>
            </div>
            <div className="max-h-[calc(85vh-5rem)] overflow-auto px-6 py-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 text-sm">
                <div><span className="font-medium text-gray-700">User:</span> {formatUser(selectedLog)}</div>
                <div><span className="font-medium text-gray-700">Action:</span> {selectedLog.action}</div>
                <div><span className="font-medium text-gray-700">Entity:</span> {selectedLog.entity}</div>
                <div><span className="font-medium text-gray-700">Entity ID:</span> {selectedLog.entityId || '-'}</div>
                <div><span className="font-medium text-gray-700">IP Address:</span> {selectedLog.ipAddress || '-'}</div>
                <div className="md:col-span-2"><span className="font-medium text-gray-700">User Agent:</span> {selectedLog.userAgent || '-'}</div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-900">Old Values</h3>
                <pre className="overflow-auto rounded-md bg-gray-50 p-3 text-xs text-gray-800">
                  {selectedLog.oldValues ? JSON.stringify(selectedLog.oldValues, null, 2) : '—'}
                </pre>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-900">New Values</h3>
                <pre className="overflow-auto rounded-md bg-gray-50 p-3 text-xs text-gray-800">
                  {selectedLog.newValues ? JSON.stringify(selectedLog.newValues, null, 2) : '—'}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
