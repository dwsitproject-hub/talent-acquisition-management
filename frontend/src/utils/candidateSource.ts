/** Resolve candidate source fields from dedicated columns (with legacy fallbacks). */

export const HEAD_HUNTER_SOURCE = 'Head hunter'
export const PLACEHOLDER_EMAIL_DOMAIN = 'no-email.local'

export const CANDIDATE_SOURCE_OPTIONS = [
  'LinkedIn',
  'Indeed',
  'Jobstreet',
  'Job Fair',
  'Local Site',
  'Referral',
  'Head hunter',
  'Others',
] as const

export function isHeadHunterSource(source: string | null | undefined): boolean {
  return String(source || '').trim() === HEAD_HUNTER_SOURCE
}

/** Synthetic emails used when Head hunter candidates have no real contact email. */
export function isPlaceholderCandidateEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return String(email).trim().toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`)
}

export function displayCandidateEmail(email: string | null | undefined): string {
  if (!email || isPlaceholderCandidateEmail(email)) return ''
  return String(email).trim()
}

export function getCandidateSourceFields(candidate: unknown): {
  source: string
  sourceDetail: string
} {
  if (!candidate || typeof candidate !== 'object') return { source: '', sourceDetail: '' }

  const record = candidate as Record<string, unknown>

  const languages =
    typeof record.languages === 'object' && record.languages !== null
      ? (record.languages as Record<string, unknown>)
      : {}

  const applicationSource = (record.applicationInfo as { source?: string } | undefined)?.source
  const columnSource = typeof record.source === 'string' ? record.source : ''
  const columnSourceDetail = typeof record.sourceDetail === 'string' ? record.sourceDetail : ''

  const ignoredApplicationSources = new Set(['manual', 'Manual Entry'])
  const sourceFromApplication =
    applicationSource && !ignoredApplicationSources.has(applicationSource) ? applicationSource : ''

  const source = String(
    columnSource || languages.source || sourceFromApplication || ''
  ).trim()
  const sourceDetail = String(
    columnSourceDetail || languages.sourceDetail || ''
  ).trim()

  return { source, sourceDetail }
}

export function formatCandidateSourceLabel(source: string): string {
  if (!source) return 'Not specified'
  return source
}

export function formatCandidateSourceDetailLabel(source: string): string {
  if (source === 'Referral') return 'By Who'
  if (source === 'Others') return 'Please specify'
  return 'Detail'
}

export function shouldShowCandidateSourceDetail(source: string, sourceDetail: string): boolean {
  return Boolean(sourceDetail && (source === 'Referral' || source === 'Others'))
}
