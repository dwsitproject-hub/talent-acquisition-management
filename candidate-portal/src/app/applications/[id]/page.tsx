'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  MapPin,
  UserCircle,
  XCircle,
} from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { fetchApplicationById, type Application, type StatusHistoryEntry } from '@/lib/api'
import NavBar from '@/components/NavBar'

// ---- status helpers ----

type StatusConfig = {
  label: string
  bg: string
  text: string
  border: string
  dot: string
  icon: 'check' | 'x' | 'clock' | 'info'
}

const STATUS_MAP: Record<string, StatusConfig> = {
  SUBMITTED:                 { label: 'Application Submitted',    bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    dot: 'bg-blue-500',    icon: 'info' },
  SCREENING:                 { label: 'CV Screening',             bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200',  dot: 'bg-indigo-500',  icon: 'info' },
  PSYCHOMETRIC_TEST:         { label: 'Psychometric Test',        bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200',  dot: 'bg-purple-500',  icon: 'info' },
  TECHNICAL_TEST:            { label: 'Technical Test',           bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200',  dot: 'bg-purple-500',  icon: 'info' },
  INTERVIEW_SCHEDULED:       { label: 'Interview Scheduled',      bg: 'bg-yellow-50',  text: 'text-yellow-700',  border: 'border-yellow-200',  dot: 'bg-yellow-500',  icon: 'clock' },
  INTERVIEW_COMPLETED:       { label: 'Interview Completed',      bg: 'bg-yellow-50',  text: 'text-yellow-700',  border: 'border-yellow-200',  dot: 'bg-yellow-500',  icon: 'check' },
  DOCUMENT_VERIFICATION:     { label: 'Document Verification',    bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200',  dot: 'bg-orange-500',  icon: 'info' },
  OFFER_PROPOSED:            { label: 'Offer in Progress',        bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200',    dot: 'bg-teal-500',    icon: 'info' },
  OFFER_APPROVED:            { label: 'Offer Approved',           bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200',    dot: 'bg-teal-500',    icon: 'check' },
  OFFER_SENT:                { label: 'Offer Sent',               bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200',    dot: 'bg-teal-500',    icon: 'info' },
  OFFER_ACCEPTED:            { label: 'Offer Accepted',           bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200',   dot: 'bg-green-500',   icon: 'check' },
  OFFER_REJECTED:            { label: 'Offer Declined',           bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-400',     icon: 'x' },
  MEDICAL_CHECKUP_SCHEDULED: { label: 'Medical Check-up',         bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-200',    dot: 'bg-cyan-500',    icon: 'clock' },
  MEDICAL_CHECKUP_COMPLETED: { label: 'Medical Completed',        bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-200',    dot: 'bg-cyan-500',    icon: 'check' },
  CONTRACT_SENT:             { label: 'Contract Sent',            bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', icon: 'info' },
  CONTRACT_SIGNED:           { label: 'Contract Signed',          bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', icon: 'check' },
  ONBOARDING:                { label: 'Onboarding',               bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200',   dot: 'bg-green-500',   icon: 'check' },
  HIRED:                     { label: 'Hired',                    bg: 'bg-green-100',  text: 'text-green-800',   border: 'border-green-300',   dot: 'bg-green-600',   icon: 'check' },
  REJECTED:                  { label: 'Not Progressed',           bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-400',     icon: 'x' },
  WITHDRAWN:                 { label: 'Application Withdrawn',    bg: 'bg-gray-100',   text: 'text-gray-600',    border: 'border-gray-200',    dot: 'bg-gray-400',    icon: 'x' },
  KEEP_IN_VIEW:              { label: 'Keep in View',             bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-400',   icon: 'clock' },
}

function getStatus(status: string): StatusConfig {
  return STATUS_MAP[status] ?? { label: status, bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200', dot: 'bg-gray-400', icon: 'info' }
}

function StatusIcon({ icon, className }: { icon: StatusConfig['icon']; className?: string }) {
  const cls = `h-4 w-4 ${className ?? ''}`
  switch (icon) {
    case 'check': return <CheckCircle2 className={cls} />
    case 'x':     return <XCircle className={cls} />
    case 'clock': return <Clock className={cls} />
    default:      return <Info className={cls} />
  }
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---- Timeline item ----
function TimelineItem({
  entry,
  isLast,
  isCurrent,
}: {
  entry: StatusHistoryEntry
  isLast: boolean
  isCurrent: boolean
}) {
  const cfg = getStatus(entry.toStatus)

  return (
    <li className="relative flex gap-4">
      {/* connector line */}
      {!isLast && (
        <span
          className="absolute left-[17px] top-9 bottom-0 w-0.5 bg-gray-100"
          aria-hidden
        />
      )}

      {/* dot */}
      <div
        className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${
          isCurrent
            ? `${cfg.bg} ${cfg.border} ${cfg.text}`
            : 'bg-white border-gray-200 text-gray-400'
        }`}
      >
        <StatusIcon icon={cfg.icon} />
      </div>

      {/* content */}
      <div className={`flex-1 pb-8 ${isLast ? 'pb-0' : ''}`}>
        <div
          className={`rounded-xl border p-4 ${
            isCurrent ? `${cfg.bg} ${cfg.border}` : 'bg-white border-gray-100'
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className={`font-semibold text-sm ${isCurrent ? cfg.text : 'text-gray-800'}`}>
              {cfg.label}
              {isCurrent && (
                <span className="ml-2 text-xs font-medium bg-white/60 rounded-full px-2 py-0.5 border border-current/20">
                  Current
                </span>
              )}
            </p>
            <time
              dateTime={entry.createdAt}
              className="text-xs text-gray-500 whitespace-nowrap"
            >
              {formatDateTime(entry.createdAt)}
            </time>
          </div>

          {entry.changedByName && (
            <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
              <UserCircle className="h-3.5 w-3.5 text-gray-400 shrink-0" aria-hidden />
              Updated by <span className="font-medium text-gray-700 ml-0.5">{entry.changedByName}</span>
            </p>
          )}

          {entry.reason && (
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">{entry.reason}</p>
          )}

          {entry.notes && (
            <p className="mt-1 text-xs text-gray-500 italic">{entry.notes}</p>
          )}
        </div>
      </div>
    </li>
  )
}

// ---- main ----

export default function ApplicationDetailPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams<{ id: string }>()

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, user, router])

  const { data: application, isLoading, isError } = useQuery<Application>({
    queryKey: ['application', params.id],
    queryFn: () => fetchApplicationById(params.id),
    enabled: !!user && !!params.id,
  })

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

  const position = application?.fptk?.positionTitle || application?.fptk?.position || 'Open position'
  const currentStatusCfg = application ? getStatus(application.status) : null
  const history = application?.statusHistory ?? []
  const sortedHistory = [...history].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col">
      <NavBar />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 sm:py-12">
        {/* back link */}
        <Link
          href="/applications"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 mb-6"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to My Applications
        </Link>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
          </div>
        ) : isError || !application ? (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-8 text-center">
            <p className="text-red-800 font-medium text-sm">Could not load this application.</p>
          </div>
        ) : (
          <>
            {/* Header card */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{position}</h1>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
                    {application.fptk?.department && (
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-3.5 w-3.5 text-gray-400" aria-hidden />
                        {application.fptk.department}
                      </span>
                    )}
                    {application.fptk?.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-gray-400" aria-hidden />
                        {application.fptk.location}
                      </span>
                    )}
                  </div>
                </div>

                {currentStatusCfg && (
                  <span
                    className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full border ${currentStatusCfg.bg} ${currentStatusCfg.text} ${currentStatusCfg.border}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${currentStatusCfg.dot}`} aria-hidden />
                    {currentStatusCfg.label}
                  </span>
                )}
              </div>

              {/* Meta grid */}
              <dl className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Applied</dt>
                  <dd className="mt-0.5 text-gray-800 font-medium">{formatDate(application.appliedAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Ref #</dt>
                  <dd className="mt-0.5 text-gray-800 font-medium font-mono text-xs">
                    {application.applicationNumber}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Stage</dt>
                  <dd className="mt-0.5 text-gray-800 font-medium">{application.currentStage} / 9</dd>
                </div>
                {application.screenedAt && (
                  <div>
                    <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Screened</dt>
                    <dd className="mt-0.5 text-gray-800 font-medium">{formatDate(application.screenedAt)}</dd>
                  </div>
                )}
                {application.interviewedAt && (
                  <div>
                    <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Interviewed</dt>
                    <dd className="mt-0.5 text-gray-800 font-medium">{formatDate(application.interviewedAt)}</dd>
                  </div>
                )}
                {application.offeredAt && (
                  <div>
                    <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Offered</dt>
                    <dd className="mt-0.5 text-gray-800 font-medium">{formatDate(application.offeredAt)}</dd>
                  </div>
                )}
                {application.hiredAt && (
                  <div>
                    <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Hired</dt>
                    <dd className="mt-0.5 text-gray-800 font-medium">{formatDate(application.hiredAt)}</dd>
                  </div>
                )}
              </dl>

              {application.rejectionReason && (
                <div className="mt-4 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
                  <span className="font-medium">Note: </span>{application.rejectionReason}
                </div>
              )}
            </div>

            {/* Status History Timeline */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Status History</h2>

              {sortedHistory.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 px-6 py-8 text-center text-sm text-gray-500">
                  No status history recorded yet.
                </div>
              ) : (
                <ol className="space-y-0">
                  {sortedHistory.map((entry, i) => (
                    <TimelineItem
                      key={entry.id}
                      entry={entry}
                      isLast={i === sortedHistory.length - 1}
                      isCurrent={i === sortedHistory.length - 1}
                    />
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
