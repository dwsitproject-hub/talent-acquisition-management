const { $Enums } = require('@prisma/client');

const PRISMA_APP_STATUS_STRINGS = new Set(Object.values($Enums.ApplicationStatus));

const UI_STATUS_TO_APP_STATUS_MAP = {
  applied: 'SUBMITTED',
  submitted: 'SUBMITTED',
  'under review': 'SCREENING',
  screening: 'SCREENING',
  shortlisted: 'SCREENING',
  'cv screening': 'SCREENING',
  'interview scheduled': 'INTERVIEW_SCHEDULED',
  interviewed: 'INTERVIEW_COMPLETED',
  'interview completed': 'INTERVIEW_COMPLETED',
  assessment: 'TECHNICAL_TEST',
  'offering creation': 'OFFER_PROPOSED',
  'pending feedback': 'OFFER_APPROVED',
  'document verification': 'DOCUMENT_VERIFICATION',
  'offer proposed': 'OFFER_PROPOSED',
  'offer approved': 'OFFER_APPROVED',
  'offer sent': 'OFFER_SENT',
  'offer accepted': 'OFFER_ACCEPTED',
  'offer declined': 'OFFER_REJECTED',
  'offer rejected': 'OFFER_REJECTED',
  mcu: 'MEDICAL_CHECKUP_COMPLETED',
  'medical checkup scheduled': 'MEDICAL_CHECKUP_SCHEDULED',
  'medical checkup completed': 'MEDICAL_CHECKUP_COMPLETED',
  'contract sent': 'CONTRACT_SENT',
  'contract signed': 'CONTRACT_SIGNED',
  'on boarding': 'ONBOARDING',
  onboarding: 'ONBOARDING',
  hired: 'HIRED',
  rejected: 'REJECTED',
  'rejected (failed interview / assessment)': 'REJECTED',
  withdrawn: 'WITHDRAWN',
  'keep in view': 'KEEP_IN_VIEW',
};

/**
 * Maps UI labels ("Assessment"), enum strings ("TECHNICAL_TEST"), and variants to Prisma ApplicationStatus.
 */
function mapUiStatusToApplicationStatus(status, fallback = 'SUBMITTED') {
  if (status === undefined || status === null) return fallback;
  const raw = String(status).trim();
  if (!raw) return fallback;
  if (PRISMA_APP_STATUS_STRINGS.has(raw)) {
    return raw;
  }
  const upper = raw.toUpperCase();
  if (PRISMA_APP_STATUS_STRINGS.has(upper)) {
    return upper;
  }
  const normalized = raw
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (UI_STATUS_TO_APP_STATUS_MAP[normalized]) {
    return UI_STATUS_TO_APP_STATUS_MAP[normalized];
  }
  return fallback;
}

// Mirrors the frontend's mapApplicationStatusToUi (frontend/src/app/summary-by-position/page.tsx)
// so cumulative stage counts are deduped at the UI-status level, not the raw enum level.
const APP_STATUS_TO_UI_STATUS_MAP = {
  SUBMITTED: 'Applied',
  SCREENING: 'Shortlisted',
  PSYCHOMETRIC_TEST: 'Under Review',
  TECHNICAL_TEST: 'Assessment',
  INTERVIEW_SCHEDULED: 'Interview Scheduled',
  INTERVIEW_COMPLETED: 'Interviewed',
  DOCUMENT_VERIFICATION: 'Under Review',
  OFFER_PROPOSED: 'Offering Creation',
  OFFER_APPROVED: 'Pending Feedback',
  OFFER_SENT: 'Under Review',
  OFFER_ACCEPTED: 'Offer Accepted',
  OFFER_REJECTED: 'Offer Rejected',
  MEDICAL_CHECKUP_SCHEDULED: 'Under Review',
  MEDICAL_CHECKUP_COMPLETED: 'MCU',
  CONTRACT_SENT: 'Offer Accepted',
  CONTRACT_SIGNED: 'Offer Accepted',
  ONBOARDING: 'On Boarding',
  HIRED: 'Offer Accepted',
  REJECTED: 'Rejected (Failed Interview / Assessment)',
  WITHDRAWN: 'Withdrawn',
  KEEP_IN_VIEW: 'Keep In View',
};

/**
 * Maps a raw Prisma ApplicationStatus enum string to its UI stage label.
 * Falls back to "Applied" for unrecognized values, same as the frontend equivalent.
 */
function mapApplicationStatusToUi(status) {
  const raw = (status || '').toString().toUpperCase().trim();
  return APP_STATUS_TO_UI_STATUS_MAP[raw] || 'Applied';
}

module.exports = {
  PRISMA_APP_STATUS_STRINGS,
  mapUiStatusToApplicationStatus,
  mapApplicationStatusToUi,
};
