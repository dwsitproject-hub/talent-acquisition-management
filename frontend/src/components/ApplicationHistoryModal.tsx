'use client'

import { useEffect, useState } from 'react'
import { XMarkIcon, ClockIcon, UserCircleIcon, CheckCircleIcon, XCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import { useModalEscape } from '@/hooks/useModalEscape'
import { ApplicationsAPI } from '@/lib/api'
import { mapApplicationStatusToUi, getApplicationStatusPillClass } from '@/utils/applicationStatusUi'

interface StatusHistoryEntry {
  id: string
  applicationId: string
  fromStatus: string | null
  toStatus: string
  changedBy: string | null
  changedByName: string | null
  reason: string | null
  notes: string | null
  createdAt: string
}

interface ApplicationHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  applicationId: string | null
  /** When stacked over another modal, use a higher z-index than the parent */
  overlayZIndex?: number
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function TimelineDot({ status, isCurrent }: { status: string; isCurrent: boolean }) {
  const uiStatus = mapApplicationStatusToUi(status)
  const pill = getApplicationStatusPillClass(uiStatus)

  const isRejectedOrWithdrawn =
    status === 'REJECTED' || status === 'WITHDRAWN' || status === 'OFFER_REJECTED'
  const isSuccess =
    status === 'HIRED' || status === 'CONTRACT_SIGNED' || status === 'OFFER_ACCEPTED' || status === 'ONBOARDING'

  const Icon = isRejectedOrWithdrawn
    ? XCircleIcon
    : isSuccess
      ? CheckCircleIcon
      : status === 'INTERVIEW_SCHEDULED' || status === 'MEDICAL_CHECKUP_SCHEDULED' || status === 'KEEP_IN_VIEW'
        ? ClockIcon
        : InformationCircleIcon

  return (
    <div
      className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2"
      style={
        isCurrent
          ? { backgroundColor: pill.backgroundColor, borderColor: pill.color, color: pill.color }
          : { backgroundColor: '#f9fafb', borderColor: '#e5e7eb', color: '#9ca3af' }
      }
    >
      <Icon className="h-4 w-4" />
    </div>
  )
}

export default function ApplicationHistoryModal({
  isOpen,
  onClose,
  applicationId,
  overlayZIndex = 50,
}: ApplicationHistoryModalProps) {
  const [loading, setLoading] = useState(false)
  const [application, setApplication] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useModalEscape(isOpen, onClose)

  useEffect(() => {
    if (!isOpen || !applicationId) return
    setLoading(true)
    setError(null)
    setApplication(null)
    ApplicationsAPI.getById(applicationId)
      .then((data) => setApplication(data))
      .catch((err) => setError(err?.response?.data?.message || err?.message || 'Failed to load application'))
      .finally(() => setLoading(false))
  }, [isOpen, applicationId])

  if (!isOpen) return null

  const candidateName = application
    ? [application.candidate?.user?.firstName, application.candidate?.user?.lastName].filter(Boolean).join(' ') || '—'
    : '—'
  const positionTitle = application?.fptk?.positionTitle || application?.fptk?.position || '—'
  const department = application?.fptk?.department || ''
  const currentStatusUi = mapApplicationStatusToUi(application?.status)
  const currentStatusPill = getApplicationStatusPillClass(currentStatusUi)

  const history: StatusHistoryEntry[] = application?.statusHistory
    ? [...application.statusHistory].sort(
        (a: StatusHistoryEntry, b: StatusHistoryEntry) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
    : []

  return (
    <div className="fixed inset-0 overflow-y-auto" style={{ zIndex: overlayZIndex }}>
      <div
        className="fixed inset-0 bg-gray-500 bg-opacity-60 transition-opacity"
        onClick={onClose}
      />

      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="relative bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 shrink-0">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 truncate">
                Application Status History
              </h2>
              {application && (
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                  <span className="font-medium text-gray-800">{candidateName}</span>
                  {positionTitle !== '—' && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span>{positionTitle}{department ? ` · ${department}` : ''}</span>
                    </>
                  )}
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={currentStatusPill}
                  >
                    {currentStatusUi}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="ml-4 shrink-0 rounded-full p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin h-8 w-8 rounded-full border-2 border-indigo-600 border-t-transparent" />
              </div>
            ) : error ? (
              <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-4 text-sm text-red-700">
                {error}
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ClockIcon className="h-10 w-10 text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-700">No status history recorded yet.</p>
                <p className="text-xs text-gray-400 mt-1">History will appear here as the application progresses.</p>
              </div>
            ) : (
              <ol className="space-y-0">
                {history.map((entry, i) => {
                  const isLast = i === history.length - 1
                  const uiLabel = mapApplicationStatusToUi(entry.toStatus)
                  const pill = getApplicationStatusPillClass(uiLabel)

                  return (
                    <li key={entry.id} className="relative flex gap-4">
                      {/* connector line */}
                      {!isLast && (
                        <span className="absolute left-[17px] top-9 bottom-0 w-0.5 bg-gray-100" aria-hidden />
                      )}

                      <TimelineDot status={entry.toStatus} isCurrent={isLast} />

                      <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-6'}`}>
                        <div
                          className="rounded-lg border p-3.5"
                          style={
                            isLast
                              ? { backgroundColor: pill.backgroundColor + '60', borderColor: pill.color + '40' }
                              : { backgroundColor: '#f9fafb', borderColor: '#f3f4f6' }
                          }
                        >
                          {/* Status label + timestamp row */}
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                                style={pill}
                              >
                                {uiLabel}
                              </span>
                              {isLast && (
                                <span className="text-xs text-gray-400 font-medium">Current</span>
                              )}
                            </div>
                            <time
                              dateTime={entry.createdAt}
                              className="text-xs text-gray-400 whitespace-nowrap"
                            >
                              {formatDateTime(entry.createdAt)}
                            </time>
                          </div>

                          {/* From → To transition label */}
                          {entry.fromStatus && (
                            <p className="mt-1.5 text-xs text-gray-400">
                              <span
                                className="rounded px-1.5 py-0.5 font-medium"
                                style={getApplicationStatusPillClass(mapApplicationStatusToUi(entry.fromStatus))}
                              >
                                {mapApplicationStatusToUi(entry.fromStatus)}
                              </span>
                              <span className="mx-1.5">→</span>
                              <span
                                className="rounded px-1.5 py-0.5 font-medium"
                                style={pill}
                              >
                                {uiLabel}
                              </span>
                            </p>
                          )}

                          {/* Changed by */}
                          {entry.changedByName && (
                            <p className="mt-1.5 flex items-center gap-1 text-xs text-gray-500">
                              <UserCircleIcon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                              Updated by{' '}
                              <span className="font-medium text-gray-700">{entry.changedByName}</span>
                            </p>
                          )}

                          {/* Reason */}
                          {entry.reason && (
                            <p className="mt-1.5 text-xs text-gray-600 leading-relaxed">
                              {entry.reason}
                            </p>
                          )}

                          {/* Notes */}
                          {entry.notes && (
                            <p className="mt-1 text-xs text-gray-400 italic">{entry.notes}</p>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex justify-between items-center">
            <p className="text-xs text-gray-400">
              {history.length > 0
                ? `${history.length} status event${history.length !== 1 ? 's' : ''} recorded`
                : ''}
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
