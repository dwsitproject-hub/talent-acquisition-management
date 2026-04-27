/**
 * Maps backend ApplicationStatus enum to the same human-readable labels
 * as Position (FPTK) detail and dashboard views.
 */
export function mapApplicationStatusToUi(status?: string | null): string {
  if (status == null || status === '') return 'Applied'
  const normalized = status.toString().toUpperCase()
  const lookup: Record<string, string> = {
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
  if (lookup[normalized]) return lookup[normalized]
  return normalized
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function getApplicationStatusPillClass(uiStatus: string): { backgroundColor: string; color: string } {
  if (uiStatus === 'Keep In View') {
    return { backgroundColor: '#e0f2fe', color: '#0369a1' }
  }
  if (uiStatus === 'Applied') {
    return { backgroundColor: '#e0e7ff', color: '#3730a3' }
  }
  if (uiStatus === 'Shortlisted' || uiStatus === 'Under Review' || uiStatus === 'Document Verification') {
    return { backgroundColor: '#fef3c7', color: '#92400e' }
  }
  if (uiStatus === 'Interview Scheduled' || uiStatus === 'Interviewed' || uiStatus === 'Assessment') {
    return { backgroundColor: '#ddd6fe', color: '#5b21b6' }
  }
  if (
    uiStatus === 'Offer Accepted' ||
    uiStatus === 'Offering Creation' ||
    uiStatus === 'Pending Feedback' ||
    uiStatus === 'Offer Sent' ||
    uiStatus === 'Hired' ||
    uiStatus === 'Contract Sent' ||
    uiStatus === 'Contract Signed' ||
    uiStatus === 'MCU' ||
    uiStatus === 'Medical Checkup Scheduled'
  ) {
    return { backgroundColor: '#dcfce7', color: '#166534' }
  }
  if (uiStatus === 'On Boarding') {
    return { backgroundColor: '#d1fae5', color: '#065f46' }
  }
  if (uiStatus === 'Rejected (Failed Interview / Assessment)' || uiStatus === 'Offer Rejected' || uiStatus === 'Withdrawn') {
    return { backgroundColor: '#fee2e2', color: '#991b1b' }
  }
  return { backgroundColor: '#f3f4f6', color: '#374151' }
}
