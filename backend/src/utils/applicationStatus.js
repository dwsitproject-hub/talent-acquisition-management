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

module.exports = {
  PRISMA_APP_STATUS_STRINGS,
  mapUiStatusToApplicationStatus,
};
