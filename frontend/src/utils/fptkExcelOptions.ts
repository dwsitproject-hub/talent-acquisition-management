/**
 * Option values aligned with Create / Edit Position modals and FPTK upload mapping.
 */

export const FPTK_STATUS_FKTK_OPTIONS = ['Pending', 'Received'] as const

/** Matches Employment Type dropdown in Create/Edit Position */
export const FPTK_EMPLOYMENT_TYPE_OPTIONS = ['Contract', 'Internship', 'Full Time Employee'] as const

/** Legacy Excel / older templates — accepted on upload and normalized */
export const FPTK_EMPLOYMENT_TYPE_LEGACY_ALIASES: Record<string, (typeof FPTK_EMPLOYMENT_TYPE_OPTIONS)[number]> = {
  kontrak: 'Contract',
  contract: 'Contract',
  probation: 'Full Time Employee',
  'full-time': 'Full Time Employee',
  fulltime: 'Full Time Employee',
  'full time': 'Full Time Employee',
  'full time employee': 'Full Time Employee',
  'part-time': 'Contract',
  parttime: 'Contract',
  internship: 'Internship',
}

export const FPTK_PRIORITY_OPTIONS = ['P0', 'P1', 'P2'] as const

export const FPTK_CRITERIA_OPTIONS = ['Staff', 'Non Staff'] as const

export const FPTK_ADDITIONAL_OR_REPLACEMENT_OPTIONS = ['Additional', 'Replacement'] as const

export const FPTK_CURRENT_STATUS_OPTIONS = [
  'Open',
  'Pending FKTK',
  'Re-Open',
  'Cancel',
  'Internal Movement',
  'Close',
] as const

/**
 * Applied candidate status labels (Edit Position modal + pipeline labels accepted by backend UI map).
 */
export const FPTK_APPLIED_CANDIDATE_STATUS_OPTIONS = [
  'Applied',
  'Under Review',
  'Shortlisted',
  'Interview Scheduled',
  'Interviewed',
  'Assessment',
  'Offering Creation',
  'Pending Feedback',
  'Document Verification',
  'Offer Sent',
  'Offer Accepted',
  'Offer Rejected',
  'MCU',
  'Medical Checkup Scheduled',
  'Medical Checkup Completed',
  'Contract Sent',
  'Contract Signed',
  'On Boarding',
  'Hired',
  'Rejected (Failed Interview / Assessment)',
  'Withdrawn',
  'Keep In View',
] as const

export function normalizeExcelEnum(value: string | undefined | null): string {
  return (value ?? '')
    .toString()
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function toAllowedSet<const T extends readonly string[]>(arr: T): Set<string> {
  return new Set(arr.map((s) => normalizeExcelEnum(s)))
}

export const ALLOWED_STATUS_FKTK = toAllowedSet(FPTK_STATUS_FKTK_OPTIONS)
export const ALLOWED_EMPLOYMENT = toAllowedSet(FPTK_EMPLOYMENT_TYPE_OPTIONS)
export const ALLOWED_PRIORITY = toAllowedSet(FPTK_PRIORITY_OPTIONS)
export const ALLOWED_CRITERIA = toAllowedSet(FPTK_CRITERIA_OPTIONS)
export const ALLOWED_ADDITIONAL_OR_REPLACEMENT = toAllowedSet(FPTK_ADDITIONAL_OR_REPLACEMENT_OPTIONS)
export const ALLOWED_CURRENT_STATUS = toAllowedSet(FPTK_CURRENT_STATUS_OPTIONS)
export const ALLOWED_APPLIED_STATUS = toAllowedSet(FPTK_APPLIED_CANDIDATE_STATUS_OPTIONS)

export function normalizeEmploymentTypeForPayload(raw: string | undefined): string | null {
  if (!raw || !String(raw).trim()) return null
  const n = normalizeExcelEnum(raw)
  if (ALLOWED_EMPLOYMENT.has(n)) {
    const match = FPTK_EMPLOYMENT_TYPE_OPTIONS.find((o) => normalizeExcelEnum(o) === n)
    return match ?? null
  }
  const legacy = FPTK_EMPLOYMENT_TYPE_LEGACY_ALIASES[n]
  return legacy ?? null
}

export function isAllowedAppliedCandidateStatus(raw: string | undefined): boolean {
  if (!raw || !String(raw).trim()) return true
  return ALLOWED_APPLIED_STATUS.has(normalizeExcelEnum(raw))
}

/** Excel template & parser: how many Applied Candidate triplets (name / email / status) to include per row. */
export const FPTK_EXCEL_APPLIED_CANDIDATE_SLOT_COUNT = 50

export function getAppliedCandidateHeaderDefs(): Array<{ fullName: string; email: string; status: string }> {
  return Array.from({ length: FPTK_EXCEL_APPLIED_CANDIDATE_SLOT_COUNT }, (_, idx) => {
    const n = idx + 1
    return {
      fullName: `Applied Candidate ${n} Full Name`,
      email: `Applied Candidate ${n} Email`,
      status: `Applied Candidate ${n} Status`,
    }
  })
}

const APPLIED_HEADER_SUFFIXES: string[] = (() => {
  const cols: string[] = []
  for (let n = 1; n <= FPTK_EXCEL_APPLIED_CANDIDATE_SLOT_COUNT; n++) {
    cols.push(
      `Applied Candidate ${n} Full Name`,
      `Applied Candidate ${n} Email`,
      `Applied Candidate ${n} Status`
    )
  }
  return cols
})()

/** Column order for template & parser (single source of truth). */
export const FPTK_TEMPLATE_HEADERS: readonly string[] = [
  'PT',
  'No FKTK',
  'Status FKTK',
  'Division',
  'Section',
  'Hiring Manager',
  'Position',
  'Employment Type',
  'Type Grade',
  'Grade2',
  'Priority',
  'Priority by month-year',
  'Job Specification and Qualifications',
  'Criteria',
  'Area',
  'Area Detail',
  'Additional or Replacement',
  'Replacement Name',
  'Resign Reason',
  'Total Request',
  'Current Status',
  'Request Date',
  ...APPLIED_HEADER_SUFFIXES,
]
