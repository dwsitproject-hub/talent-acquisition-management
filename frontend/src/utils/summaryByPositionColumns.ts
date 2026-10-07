/** Summary-by-position pipeline columns (keep in sync with backend applicationStatus.js). */

export type SummaryPipelineColumnKey =
  | 'applied'
  | 'interview'
  | 'rejectInterview'
  | 'offerSent'
  | 'offerAccepted'
  | 'joinDates'
  | 'offerReject'
  | 'withdrawn'

export type SummaryPipelineCounts = Record<SummaryPipelineColumnKey, number>

export const SUMMARY_PIPELINE_COLUMNS: { key: SummaryPipelineColumnKey; label: string }[] = [
  { key: 'applied', label: 'Applied' },
  { key: 'interview', label: 'Interview' },
  { key: 'rejectInterview', label: 'Reject (interview / assessment)' },
  { key: 'offerSent', label: 'Offer Sent' },
  { key: 'offerAccepted', label: 'Offer Accepted' },
  { key: 'joinDates', label: 'Join dates' },
  { key: 'offerReject', label: 'Offer Reject' },
  { key: 'withdrawn', label: 'Withdrawn' },
]

export function emptySummaryPipelineCounts(): SummaryPipelineCounts {
  return {
    applied: 0,
    interview: 0,
    rejectInterview: 0,
    offerSent: 0,
    offerAccepted: 0,
    joinDates: 0,
    offerReject: 0,
    withdrawn: 0,
  }
}

export function getSummaryPipelineColumnBadgeClass(key: SummaryPipelineColumnKey): string {
  switch (key) {
    case 'applied':
      return 'bg-indigo-100 text-indigo-800'
    case 'interview':
      return 'bg-violet-100 text-violet-800'
    case 'rejectInterview':
    case 'offerReject':
    case 'withdrawn':
      return 'bg-red-100 text-red-700'
    case 'offerSent':
      return 'bg-amber-100 text-amber-800'
    case 'offerAccepted':
      return 'bg-green-100 text-green-700'
    case 'joinDates':
      return 'bg-emerald-100 text-emerald-800'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}
