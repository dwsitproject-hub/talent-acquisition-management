/** Resolve candidate source fields from dedicated columns (with legacy fallbacks). */

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
