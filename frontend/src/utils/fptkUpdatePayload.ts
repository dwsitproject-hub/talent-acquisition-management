import { mapUiStatusToApplicationStatus } from '@/utils/applicationStatusUi'

export const DEFAULT_FPTK_CURRENT_STATUS = 'Pending FKTK'

const APPLICATION_STATUS_UI_LABELS: Record<string, string> = {
  DRAFT: 'Applied',
  SUBMITTED: 'Applied',
  SCREENING: 'Shortlisted',
  PSYCHOMETRIC_TEST: 'Under Review',
  TECHNICAL_TEST: 'Assessment',
  INTERVIEW_SCHEDULED: 'Interview Scheduled',
  INTERVIEW_COMPLETED: 'Interviewed',
  DOCUMENT_VERIFICATION: 'Document Verification',
  OFFER_PROPOSED: 'Offering Creation',
  OFFER_APPROVED: 'Pending Feedback',
  OFFER_SENT: 'Offer Sent',
  OFFER_ACCEPTED: 'Offer Accepted',
  OFFER_REJECTED: 'Offer Rejected',
  MEDICAL_CHECKUP_SCHEDULED: 'Medical Checkup Scheduled',
  MEDICAL_CHECKUP_COMPLETED: 'MCU',
  CONTRACT_SENT: 'Contract Sent',
  CONTRACT_SIGNED: 'Contract Signed',
  ONBOARDING: 'On Boarding',
  HIRED: 'Hired',
  REJECTED: 'Rejected (Failed Interview / Assessment)',
  WITHDRAWN: 'Withdrawn',
  KEEP_IN_VIEW: 'Keep In View',
}

export function mapUiStatusToDbStatus(value?: string, fallback?: string) {
  if (!value) return fallback || 'DRAFT'
  const normalized = value.trim().toLowerCase()
  const lookup: Record<string, string> = {
    draft: 'DRAFT',
    active: 'OPEN',
    open: 'OPEN',
    paused: 'DRAFT',
    closed: 'FILLED',
    filled: 'FILLED',
    cancelled: 'CANCELLED',
    approved: 'APPROVED',
    expired: 'EXPIRED',
    'partially filled': 'PARTIALLY_FILLED',
    partially_filled: 'PARTIALLY_FILLED',
    're-open': 'OPEN',
    'pending fktk': 'DRAFT',
    hold: 'DRAFT',
    cancel: 'CANCELLED',
    'internal movement': 'DRAFT',
    close: 'FILLED',
  }
  return lookup[normalized] || fallback || 'DRAFT'
}

export function mapAppliedCandidatesForPayload(candidates?: any[]) {
  if (!Array.isArray(candidates)) return []

  return candidates
    .map((candidate: any) => {
      if (!candidate) return null
      const rawStatus = candidate.status || candidate.backendStatus || 'Applied'
      const statusFromEnum =
        typeof rawStatus === 'string' && /^[A-Z0-9_]+$/.test(rawStatus.trim()) && rawStatus.length > 1
          ? APPLICATION_STATUS_UI_LABELS[rawStatus.trim()] || rawStatus
          : rawStatus
      return {
        id: candidate.candidateId || candidate.id,
        candidateId: candidate.candidateId || candidate.id,
        fullName: candidate.fullName || candidate.name,
        email: candidate.email,
        status: mapUiStatusToApplicationStatus(candidate.status || statusFromEnum),
        appliedDate: candidate.appliedDate || candidate.appliedAt || new Date().toISOString(),
        source: candidate.source,
        interviews: candidate.interviews || [],
        rejectedDate: candidate.rejectedDate
          ? new Date(candidate.rejectedDate).toISOString()
          : candidate.rejectedAt
            ? new Date(candidate.rejectedAt).toISOString()
            : null,
        withdrawDate: candidate.withdrawDate
          ? new Date(candidate.withdrawDate).toISOString()
          : candidate.withdrawnAt
            ? new Date(candidate.withdrawnAt).toISOString()
            : null,
        joinDate:
          candidate.joinDate == null || candidate.joinDate === ''
            ? null
            : new Date(
                /^\d{4}-\d{2}-\d{2}$/.test(String(candidate.joinDate).trim())
                  ? `${String(candidate.joinDate).trim().slice(0, 10)}T12:00:00.000Z`
                  : String(candidate.joinDate)
              ).toISOString(),
      }
    })
    .filter(Boolean)
}

export function buildFptkUpdatePayload(selectedJobPosting: any, updatedData: any) {
  const current: any = selectedJobPosting
  const currentStatus = updatedData.status || current.currentStatus || DEFAULT_FPTK_CURRENT_STATUS
  const statusEnum = mapUiStatusToDbStatus(updatedData.status, current.statusEnum || 'DRAFT')
  const hasAppliedCandidates = Object.prototype.hasOwnProperty.call(updatedData, 'appliedCandidates')
  const appliedCandidatesPayload = hasAppliedCandidates
    ? mapAppliedCandidatesForPayload(updatedData.appliedCandidates)
    : undefined

  const payload: any = {
    pt: updatedData.pt ?? current.pt,
    noFktk: updatedData.noFktk ?? current.noFktk,
    statusFktk: updatedData.statusFktk ?? current.statusFktk,
    division: updatedData.division ?? current.department ?? current.division,
    section: updatedData.section ?? current.section,
    hiringManager: updatedData.hiringManager ?? current.hiringManager,
    position: updatedData.position ?? current.position,
    department: updatedData.division ?? current.department ?? current.division,
    location: updatedData.area
      ? updatedData.area === 'Site'
        ? 'Site'
        : 'Head Office'
      : current.location ?? current.area,
    employmentType: updatedData.employmentType ?? current.employmentType ?? current.type,
    typeGrade: updatedData.typeGrade ?? current.typeGrade,
    priority: updatedData.urgentNormal ?? current.urgentNormal ?? current.priority,
    priorityByMonthYear: updatedData.priorityByMonthYear ?? current.priorityByMonthYear,
    jobSpecification: updatedData.jobSpecification ?? current.jobSpecification ?? current.description,
    criteria: updatedData.criteria ?? current.criteria,
    area: updatedData.area ?? current.area,
    areaDetail: updatedData.areaDetail ?? current.areaDetail,
    additionalOrReplacement: updatedData.additionalOrReplacement ?? current.additionalOrReplacement,
    replacementName: updatedData.replacementName ?? current.replacementName,
    resignReason: updatedData.resignReason ?? current.resignReason,
    numberOfPositions: updatedData.numberOfPositions ?? current.numberOfPositions ?? current.totalRequest ?? 1,
    totalRequest: updatedData.totalRequest ?? current.totalRequest ?? current.numberOfPositions ?? 1,
    requestDate: updatedData.requestDate ?? current.requestDate,
    currentStatus,
    status: statusEnum,
    remark: updatedData.remark ?? current.remark,
    requiredSkills: updatedData.skills ?? current.skills ?? [],
    ...(updatedData.fptkFile ? { fptkFile: updatedData.fptkFile } : {}),
    ...(updatedData.fptkReceiveDate && updatedData.fptkReceiveDate.trim() !== ''
      ? { fptkReceiveDate: updatedData.fptkReceiveDate }
      : {}),
  }

  if (hasAppliedCandidates) {
    payload.appliedCandidates = appliedCandidatesPayload || []
  }

  return payload
}
