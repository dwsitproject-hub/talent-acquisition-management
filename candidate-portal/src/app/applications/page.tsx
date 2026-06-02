'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Briefcase,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
} from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { fetchMyApplications, type Application } from '@/lib/api'
import NavBar from '@/components/NavBar'

// ---- status display helpers ----

type StatusConfig = {
  label: string
  color: string // tailwind classes
  dot: string
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  SUBMITTED:                 { label: 'Submitted',              color: 'bg-blue-50 text-blue-700',     dot: 'bg-blue-500' },
  SCREENING:                 { label: 'Screening',              color: 'bg-indigo-50 text-indigo-700', dot: 'bg-indigo-500' },
  PSYCHOMETRIC_TEST:         { label: 'Psychometric Test',      color: 'bg-purple-50 text-purple-700', dot: 'bg-purple-500' },
  TECHNICAL_TEST:            { label: 'Technical Test',         color: 'bg-purple-50 text-purple-700', dot: 'bg-purple-500' },
  INTERVIEW_SCHEDULED:       { label: 'Interview Scheduled',    color: 'bg-yellow-50 text-yellow-700', dot: 'bg-yellow-500' },
  INTERVIEW_COMPLETED:       { label: 'Interview Completed',    color: 'bg-yellow-50 text-yellow-700', dot: 'bg-yellow-500' },
  DOCUMENT_VERIFICATION:     { label: 'Document Verification',  color: 'bg-orange-50 text-orange-700', dot: 'bg-orange-500' },
  OFFER_PROPOSED:            { label: 'Offer Proposed',         color: 'bg-teal-50 text-teal-700',     dot: 'bg-teal-500' },
  OFFER_APPROVED:            { label: 'Offer Approved',         color: 'bg-teal-50 text-teal-700',     dot: 'bg-teal-500' },
  OFFER_SENT:                { label: 'Offer Sent',             color: 'bg-teal-50 text-teal-700',     dot: 'bg-teal-500' },
  OFFER_ACCEPTED:            { label: 'Offer Accepted',         color: 'bg-green-50 text-green-700',   dot: 'bg-green-500' },
  OFFER_REJECTED:            { label: 'Offer Declined',         color: 'bg-red-50 text-red-700',       dot: 'bg-red-500' },
  MEDICAL_CHECKUP_SCHEDULED: { label: 'Medical Check-up',       color: 'bg-cyan-50 text-cyan-700',     dot: 'bg-cyan-500' },
  MEDICAL_CHECKUP_COMPLETED: { label: 'Medical Completed',      color: 'bg-cyan-50 text-cyan-700',     dot: 'bg-cyan-500' },
  CONTRACT_SENT:             { label: 'Contract Sent',          color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  CONTRACT_SIGNED:           { label: 'Contract Signed',        color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  ONBOARDING:                { label: 'Onboarding',             color: 'bg-green-50 text-green-700',   dot: 'bg-green-500' },
  HIRED:                     { label: 'Hired',                  color: 'bg-green-100 text-green-800',  dot: 'bg-green-600' },
  REJECTED:                  { label: 'Not Progressed',         color: 'bg-red-50 text-red-700',       dot: 'bg-red-400' },
  WITHDRAWN:                 { label: 'Withdrawn',              color: 'bg-gray-100 text-gray-600',    dot: 'bg-gray-400' },
  KEEP_IN_VIEW:              { label: 'Keep in View',           color: 'bg-amber-50 text-amber-700',   dot: 'bg-amber-400' },
}

function statusConfig(status: string): StatusConfig {
  return STATUS_CONFIG[status] ?? { label: status, color: 'bg-gray-50 text-gray-700', dot: 'bg-gray-400' }
}

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig(status)
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${cfg.dot}`} aria-hidden />
      {cfg.label}
    </span>
  )
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// Last meaningful status event from the history
function lastEvent(app: Application): string {
  if (!app.statusHistory?.length) return formatDate(app.appliedAt)
  const last = app.statusHistory[app.statusHistory.length - 1]
  return formatDate(last.createdAt)
}

// ---- component ----

export default function MyApplicationsPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, user, router])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-applications'],
    queryFn: () => fetchMyApplications({ limit: 50 }),
    enabled: !!user,
  })

  const applications = data?.data ?? []

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col">
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col">
      <NavBar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 sm:py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Applications</h1>
          <p className="mt-1 text-gray-500 text-sm">
            Track the status and history of every position you&apos;ve applied for.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-8 text-center">
            <p className="text-red-800 font-medium text-sm">Could not load your applications.</p>
            <button
              onClick={() => refetch()}
              className="mt-4 text-sm text-red-700 underline"
            >
              Try again
            </button>
          </div>
        ) : applications.length === 0 ? (
          <div className="rounded-xl border border-gray-100 bg-white px-6 py-16 text-center">
            <Briefcase className="mx-auto h-10 w-10 text-gray-300 mb-4" aria-hidden />
            <p className="font-semibold text-gray-800">No applications yet</p>
            <p className="text-sm text-gray-500 mt-1">Browse open positions and hit Apply.</p>
            <Link
              href="/jobs"
              className="mt-6 inline-block bg-primary-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700"
            >
              Browse Jobs
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {applications.map((app) => {
              const position = app.fptk?.positionTitle || app.fptk?.position || 'Open position'
              const dept = app.fptk?.department
              const location = app.fptk?.location

              return (
                <li key={app.id}>
                  <Link
                    href={`/applications/${app.id}`}
                    className="group flex items-start justify-between gap-4 bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:border-primary-200 hover:shadow-md transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h2 className="font-semibold text-gray-900 text-base truncate">{position}</h2>
                        <StatusBadge status={app.status} />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                        {dept && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
                            {dept}
                          </span>
                        )}
                        {location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
                            {location}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
                          Applied {formatDate(app.appliedAt)}
                        </span>
                      </div>

                      {/* Mini timeline: last 3 history events */}
                      {app.statusHistory && app.statusHistory.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {app.statusHistory.slice(-3).map((h) => (
                            <span
                              key={h.id}
                              className="text-xs bg-gray-50 border border-gray-100 rounded px-2 py-0.5 text-gray-600"
                            >
                              {statusConfig(h.toStatus).label}
                              <span className="text-gray-400 ml-1">{formatDate(h.createdAt)}</span>
                            </span>
                          ))}
                          {app.statusHistory.length > 3 && (
                            <span className="text-xs text-gray-400 self-center">
                              +{app.statusHistory.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-primary-400 shrink-0 mt-0.5 transition-colors" aria-hidden />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
