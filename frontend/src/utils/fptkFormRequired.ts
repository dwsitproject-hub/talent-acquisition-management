import type { CSSProperties } from 'react'

/**
 * Required field keys for Create/Edit Position (FPTK) — keep in sync with form validation.
 */
export const FPTK_REQUIRED_FORM_KEYS = [
  'pt',
  'division',
  'section',
  'hiringManager',
  'position',
  'employmentType',
  'criteria',
  'area',
  'areaDetail',
  'additionalOrReplacement',
  'requestDate',
  'jobSpecification',
] as const

export type FptkRequiredKey = (typeof FPTK_REQUIRED_FORM_KEYS)[number]

const LABELS: Record<FptkRequiredKey, string> = {
  pt: 'PT (entity)',
  division: 'Division',
  section: 'Section',
  hiringManager: 'Hiring Manager',
  position: 'Position',
  employmentType: 'Employment Type',
  criteria: 'Criteria',
  area: 'Area',
  areaDetail: 'Area detail',
  additionalOrReplacement: 'Additional or Replacement',
  requestDate: 'Request Date',
  jobSpecification: 'Job specification',
}

export function fptkRequiredFieldLabel(key: FptkRequiredKey): string {
  return LABELS[key] || key
}

export function getMissingFptkRequiredKeys(formData: Record<string, unknown>): FptkRequiredKey[] {
  return FPTK_REQUIRED_FORM_KEYS.filter((field) => {
    const value = formData[field]
    if (value === undefined || value === null) return true
    if (typeof value === 'string' && !value.trim()) return true
    return false
  })
}

export function fptkRequiredFieldsErrorMessage(missing: FptkRequiredKey[]): string {
  if (missing.length === 0) return ''
  const lines = missing.map((k) => `• ${fptkRequiredFieldLabel(k)}`)
  return `Please complete the following required field${missing.length > 1 ? 's' : ''}:\n${lines.join('\n')}`
}

/** Merged into input/select/textarea `style` when a required FPTK field is missing after save attempt. */
export function fptkRequiredFieldHighlightStyle(isInvalid: boolean): CSSProperties {
  if (!isInvalid) return {}
  return {
    border: '1px solid #f87171',
    backgroundColor: '#fff1f2',
    boxShadow: '0 0 0 1px rgba(220, 38, 38, 0.2)',
  }
}
