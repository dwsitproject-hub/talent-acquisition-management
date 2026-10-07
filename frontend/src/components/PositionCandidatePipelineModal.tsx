'use client'

import { useEffect, useState } from 'react'
import {
  XMarkIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowUturnLeftIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline'
import { useModalEscape } from '@/hooks/useModalEscape'
import { FPTKAPI } from '@/lib/api'
import ApplicationHistoryModal from '@/components/ApplicationHistoryModal'
import { getApplicationStatusPillClass } from '@/utils/applicationStatusUi'

type StageOutcome =
  | 'passed'
  | 'rejected'
  | 'withdrawn'
  | 'pending'
  | 'accepted'
  | 'not_yet'
  | 'not_applicable'

type SlaBasis = 'interview' | 'rejection' | 'withdrawal' | 'elapsed' | null

interface CandidateStage {
  outcome: StageOutcome
  date: string | null
  slaDays?: number | null
  slaPending?: boolean
  slaBasis?: SlaBasis
  sentDate?: string | null
}

interface CandidatePipelineRow {
  applicationId: string
  candidateId: string | null
  candidateName: string
  email: string
  currentStatus: string
  appliedAt: string | null
  interview: CandidateStage
  offer: CandidateStage
  joinDate: string | null
}

interface PositionCandidatePipelinePayload {
  fptk: {
    id: string
    position: string
    division: string
    section: string
    area: string
    location: string
    currentStatus: string
  }
  candidates: CandidatePipelineRow[]
}

/** Same stack as PositionEditOverlay / EditJobPostingModal — above sidebar (lg:z-50) and header (z-40). */
const OVERLAY_Z_INDEX = 10050

interface PositionCandidatePipelineModalProps {
  isOpen: boolean
  onClose: () => void
  fptkId: string | null
  /** Shown in the header while the full payload is still loading. */
  fallbackPositionLabel?: string
}

type SortKey =
  | 'candidate'
  | 'applied'
  | 'interviewDate'
  | 'interviewResult'
  | 'slaToInterview'
  | 'offerDate'
  | 'offerResult'
  | 'slaToOfferDecision'
  | 'joinDate'

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'candidate', label: 'Candidate' },
  { key: 'applied', label: 'Applied' },
  { key: 'interviewDate', label: 'Interview Date' },
  { key: 'interviewResult', label: 'Interview Result' },
  { key: 'slaToInterview', label: 'SLA to Interview' },
  { key: 'offerDate', label: 'Offer Date' },
  { key: 'offerResult', label: 'Offer Result' },
  { key: 'slaToOfferDecision', label: 'SLA to Offer Decision' },
  { key: 'joinDate', label: 'Join Date' },
]

function toTime(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return isNaN(t) ? null : t
}

/** The date actually shown by <DateCell>, so sorting by Offer Date matches what's on screen
 *  (falls back to the sent date while a decision is still pending). */
function dateCellTime(stage: CandidateStage): number | null {
  return toTime(stage.date) ?? (stage.outcome === 'pending' ? toTime(stage.sentDate) : null)
}

/** Extracts the comparable value for a column, or null (always sorted last, either direction). */
function getSortValue(row: CandidatePipelineRow, key: SortKey): string | number | null {
  switch (key) {
    case 'candidate':
      return row.candidateName?.toLowerCase() || null
    case 'applied':
      return toTime(row.appliedAt)
    case 'interviewDate':
      return dateCellTime(row.interview)
    case 'interviewResult':
      return OUTCOME_CONFIG[row.interview.outcome]?.label.toLowerCase() || null
    case 'slaToInterview':
      return row.interview.slaDays ?? null
    case 'offerDate':
      return dateCellTime(row.offer)
    case 'offerResult':
      return OUTCOME_CONFIG[row.offer.outcome]?.label.toLowerCase() || null
    case 'slaToOfferDecision':
      return row.offer.slaDays ?? null
    case 'joinDate':
      return toTime(row.joinDate)
    default:
      return null
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Short caption shown under the SLA badge when the end date isn't simply "the interview". */
function slaBasisCaption(basis: SlaBasis): string | null {
  if (basis === 'rejection') return 'to rejection · no interview held'
  if (basis === 'withdrawal') return 'to withdrawal · no interview held'
  return null
}

function SlaBadge({
  days,
  pending,
  basis,
}: {
  days: number | null | undefined
  pending?: boolean
  basis?: SlaBasis
}) {
  if (days == null) return <span className="text-gray-300 text-xs">—</span>
  const caption = slaBasisCaption(basis ?? null)
  return (
    <div>
      <span
        className={[
          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
          pending ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-700',
        ].join(' ')}
        title={
          pending
            ? `${days} working days so far (Indonesia calendar)`
            : `${days} working days (Indonesia calendar)${caption ? ` — ${caption}` : ''}`
        }
      >
        {days}d{pending ? ' so far' : ''}
      </span>
      {caption && <div className="text-[10px] text-gray-400 mt-0.5 whitespace-nowrap">{caption}</div>}
    </div>
  )
}

const OUTCOME_CONFIG: Record<
  StageOutcome,
  { label: string; icon: typeof CheckCircleIcon; className: string }
> = {
  passed: { label: 'Passed', icon: CheckCircleIcon, className: 'text-green-600' },
  accepted: { label: 'Accepted', icon: CheckCircleIcon, className: 'text-green-600' },
  rejected: { label: 'Rejected', icon: XCircleIcon, className: 'text-red-600' },
  withdrawn: { label: 'Withdrawn', icon: ArrowUturnLeftIcon, className: 'text-gray-400' },
  pending: { label: 'Awaiting decision', icon: ClockIcon, className: 'text-amber-500' },
  not_yet: { label: 'Not yet', icon: ClockIcon, className: 'text-gray-300' },
  not_applicable: { label: '—', icon: ClockIcon, className: 'text-gray-300' },
}

/**
 * Shows ONLY the pass/fail/pending verdict (icon + label) — no date here.
 * The date lives in its own "Interview Date" / "Offer Date" column instead,
 * so each column answers exactly one question:
 *   - Date column   → "when did this happen?"
 *   - Result column → "did they pass, and is anything more needed?"
 *   - SLA column    → "how many (working) days did that take?"
 */
function StageCell({
  stage,
  pendingLabel,
}: {
  stage: CandidateStage
  /** Override label used for the "pending" outcome (differs between interview/offer stages). */
  pendingLabel?: string
}) {
  const cfg = OUTCOME_CONFIG[stage.outcome]
  const Icon = cfg.icon
  const label = stage.outcome === 'pending' && pendingLabel ? pendingLabel : cfg.label

  if (stage.outcome === 'not_applicable' || stage.outcome === 'not_yet') {
    return <span className="text-gray-300 text-xs">—</span>
  }

  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <Icon className={`h-4 w-4 shrink-0 ${cfg.className}`} />
      <span className={`text-sm ${cfg.className}`}>{label}</span>
    </div>
  )
}

/**
 * The "when did this happen" column — just the date, independent of outcome/SLA.
 * For the offer stage, `stage.date` is the *decision* date (accepted/rejected/withdrawn).
 * While a decision is still pending, there's no decision date yet, so this falls back to
 * showing the offer-sent date instead (labeled, so it's clearly "sent" not "decided").
 */
function DateCell({ stage }: { stage: CandidateStage }) {
  if (stage.date) {
    return <span className="text-sm text-gray-700 whitespace-nowrap">{formatDate(stage.date)}</span>
  }
  if (stage.outcome === 'pending' && stage.sentDate) {
    return (
      <span className="text-sm text-gray-500 whitespace-nowrap">
        {formatDate(stage.sentDate)} <span className="text-xs text-gray-400">(sent)</span>
      </span>
    )
  }
  return <span className="text-gray-300 text-xs">—</span>
}

export default function PositionCandidatePipelineModal({
  isOpen,
  onClose,
  fptkId,
  fallbackPositionLabel,
}: PositionCandidatePipelineModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PositionCandidatePipelinePayload | null>(null)
  const [historyApplicationId, setHistoryApplicationId] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('applied')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  useModalEscape(isOpen && !historyApplicationId, onClose)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortIndicator = (key: SortKey) => (
    <span className="ml-1 text-gray-300">
      {sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
    </span>
  )

  useEffect(() => {
    if (!isOpen || !fptkId) return
    setLoading(true)
    setError(null)
    setData(null)
    FPTKAPI.getCandidatePipeline(fptkId)
      .then((payload) => setData(payload))
      .catch((err) =>
        setError(err?.response?.data?.message || err?.message || 'Failed to load candidates')
      )
      .finally(() => setLoading(false))
  }, [isOpen, fptkId])

  if (!isOpen) return null

  const sortedCandidates = [...(data?.candidates ?? [])].sort((a, b) => {
    const av = getSortValue(a, sortKey)
    const bv = getSortValue(b, sortKey)
    const aNull = av === null
    const bNull = bv === null
    // Rows missing this column's value always sort to the end, regardless of direction —
    // e.g. candidates with no offer yet shouldn't jump to the top when sorting descending.
    if (aNull && bNull) return 0
    if (aNull) return 1
    if (bNull) return -1
    const dir = sortDir === 'asc' ? 1 : -1
    if (typeof av === 'string' && typeof bv === 'string') {
      return av.localeCompare(bv) * dir
    }
    return ((av as number) - (bv as number)) * dir
  })

  const fptk = data?.fptk
  const headerLine = [fptk?.division, fptk?.section].filter((v) => v && v !== '-').join(' > ')
  const locationLine = [fptk?.area, fptk?.location].filter((v) => v && v !== '-').join(' - ')

  return (
    <div className="fixed inset-0 overflow-y-auto" style={{ zIndex: OVERLAY_Z_INDEX }}>
      {/*
        Matches EditJobPostingModal's backdrop exactly. Uses an inline style rather than
        Tailwind's bg-opacity-* utility because this project is on Tailwind v4, which
        removed bg-opacity-* (opacity modifiers now require the bg-black/50 slash syntax) —
        bg-opacity-60 silently no-ops there and renders fully opaque instead of translucent.
      */}
      <div
        className="fixed inset-0 transition-opacity"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        onClick={onClose}
      />

      {/*
        Responsive dialog: edge-to-edge bottom sheet on mobile (no outer padding, rounded
        top corners only), centered capped-width dialog from sm: up — same breakpoint
        pattern already used by AddCandidateModal / SimpleAddCandidateModal / BulkUploadModal.
      */}
      <div className="flex min-h-screen items-end sm:items-center justify-center p-0 sm:p-4">
        <div
          className="relative bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-6xl lg:max-w-7xl h-[92vh] sm:h-auto sm:max-h-[90vh] flex flex-col transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100 shrink-0">
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                {fptk?.position || fallbackPositionLabel || 'Position Candidates'}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:text-sm text-gray-500">
                {headerLine && <span className="truncate">{headerLine}</span>}
                {headerLine && locationLine && <span className="text-gray-300">·</span>}
                {locationLine && <span className="truncate">{locationLine}</span>}
              </div>
            </div>
            <button
              onClick={onClose}
              className="ml-2 shrink-0 rounded-full p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              aria-label="Close"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto px-4 sm:px-6 py-4 sm:py-5">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin h-8 w-8 rounded-full border-2 border-indigo-600 border-t-transparent" />
              </div>
            ) : error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
                <ExclamationCircleIcon className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            ) : !data || data.candidates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ClockIcon className="h-10 w-10 text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-700">No candidates have applied yet.</p>
              </div>
            ) : (
              // Dedicated horizontal-scroll container (bleeds to the card edge on mobile) so the
              // table can keep readable column widths instead of squeezing on narrow screens.
              <div className="-mx-4 sm:mx-0 overflow-x-auto">
                <table className="min-w-[960px] sm:min-w-full w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {COLUMNS.map((col, i) => (
                        <th
                          key={col.key}
                          onClick={() => handleSort(col.key)}
                          aria-sort={
                            sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
                          }
                          className={[
                            'px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider select-none whitespace-nowrap bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors',
                            i === 0 ? 'sticky left-0 z-10 pl-4 sm:pl-3' : '',
                          ].join(' ')}
                        >
                          {col.label}
                          {sortIndicator(col.key)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {sortedCandidates.map((row) => (
                      <tr
                        key={row.applicationId}
                        className="group hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => setHistoryApplicationId(row.applicationId)}
                        title="View full status history"
                      >
                        <td className="px-3 py-2 pl-4 sm:pl-3 max-w-[16rem] sticky left-0 z-10 bg-white group-hover:bg-gray-50 transition-colors">
                          <div className="text-sm font-medium text-indigo-600 hover:underline truncate">
                            {row.candidateName}
                          </div>
                          <div className="text-xs text-gray-400 truncate">{row.email}</div>
                          {row.currentStatus && (
                            <span
                              className="inline-flex items-center mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate max-w-full"
                              style={getApplicationStatusPillClass(row.currentStatus)}
                              title={`Current status: ${row.currentStatus}`}
                            >
                              {row.currentStatus}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">
                          {formatDate(row.appliedAt)}
                        </td>
                        <td className="px-3 py-2">
                          <DateCell stage={row.interview} />
                        </td>
                        <td className="px-3 py-2">
                          <StageCell stage={row.interview} pendingLabel="Awaiting interview" />
                        </td>
                        <td className="px-3 py-2">
                          <SlaBadge
                            days={row.interview.slaDays}
                            pending={row.interview.slaPending}
                            basis={row.interview.slaBasis}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <DateCell stage={row.offer} />
                        </td>
                        <td className="px-3 py-2">
                          <StageCell stage={row.offer} pendingLabel="Awaiting offer decision" />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <SlaBadge days={row.offer.slaDays} pending={row.offer.slaPending} />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">
                          {formatDate(row.joinDate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 shrink-0 flex flex-col-reverse sm:flex-row gap-2 sm:gap-0 sm:justify-between sm:items-center">
            <p className="text-xs text-gray-400">
              {data ? `${data.candidates.length} candidate${data.candidates.length !== 1 ? 's' : ''}` : ''}
              {' · '}Click a candidate to view full status history
            </p>
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <ApplicationHistoryModal
        isOpen={!!historyApplicationId}
        onClose={() => setHistoryApplicationId(null)}
        applicationId={historyApplicationId}
        overlayZIndex={OVERLAY_Z_INDEX + 100}
      />
    </div>
  )
}
