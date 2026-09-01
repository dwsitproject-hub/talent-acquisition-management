const { $Enums } = require('@prisma/client');

const PRISMA_APP_STATUS_STRINGS = new Set(Object.values($Enums.ApplicationStatus));

const UI_STATUS_TO_APP_STATUS_MAP = {
  applied: 'SUBMITTED',
  submitted: 'SUBMITTED',
  // Keep in sync with PIPELINE_STATUS_UI_LABELS (PSYCHOMETRIC_TEST = Under Review).
  'under review': 'PSYCHOMETRIC_TEST',
  screening: 'SCREENING',
  shortlisted: 'SCREENING',
  'cv screening': 'SCREENING',
  'interview scheduled': 'INTERVIEW_SCHEDULED',
  interviewed: 'INTERVIEW_COMPLETED',
  'interview completed': 'INTERVIEW_COMPLETED',
  assessment: 'TECHNICAL_TEST',
  'offering creation': 'OFFER_PROPOSED',
  'offer creation': 'OFFER_PROPOSED',
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

/**
 * Per-candidate pipeline status label (distinct label per raw status, no collapsing).
 * Mirrors frontend/src/utils/applicationStatusUi.ts's mapApplicationStatusToUi, which is
 * what the candidate status dropdown / PUT status endpoint actually display and accept.
 * Deliberately kept separate from APP_STATUS_TO_UI_STATUS_MAP above, which intentionally
 * collapses some raw statuses (e.g. DOCUMENT_VERIFICATION, OFFER_SENT) into "Under Review"
 * for the Summary by Position "stage reached" report - collapsing those here would make
 * the status-transition rules below unable to distinguish those pipeline stages.
 */
const PIPELINE_STATUS_UI_LABELS = {
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
};

function mapApplicationStatusToPipelineUi(status) {
  const raw = (status || '').toString().toUpperCase().trim();
  return PIPELINE_STATUS_UI_LABELS[raw] || 'Applied';
}

/** Shorthand used for the generic "Reject" action available on the candidate status dropdown. */
const REJECTED_UI_STATUS = 'Rejected (Failed Interview / Assessment)';

/**
 * Candidate pipeline status workflow: maps each status to the list of statuses a user is
 * allowed to move a candidate into next. Statuses not present here are considered outside
 * the managed workflow (legacy / unrecognized values) and are unrestricted - see
 * `getAllowedNextStatuses`. Keep in sync with frontend/src/utils/applicationStatusUi.ts.
 */
const STATUS_TRANSITIONS = {
  Applied: ['Under Review', REJECTED_UI_STATUS, 'Withdrawn'],
  'Under Review': ['Shortlisted', REJECTED_UI_STATUS, 'Withdrawn'],
  Shortlisted: ['Interview Scheduled', REJECTED_UI_STATUS, 'Withdrawn'],
  'Interview Scheduled': ['Interviewed', REJECTED_UI_STATUS, 'Withdrawn', 'Keep In View'],
  Interviewed: ['Assessment', 'Document Verification', REJECTED_UI_STATUS, 'Keep In View', 'Withdrawn'],
  Assessment: ['Document Verification', REJECTED_UI_STATUS, 'Keep In View', 'Withdrawn'],
  'Document Verification': ['Offering Creation', 'Withdrawn'],
  'Offering Creation': ['Offer Sent'],
  'Offer Sent': ['Pending Feedback', 'Offer Accepted', 'Withdrawn'],
  'Pending Feedback': ['Offer Accepted', 'Withdrawn'],
  'Offer Accepted': ['MCU', 'Withdrawn'],
  MCU: ['On Boarding', 'Withdrawn', REJECTED_UI_STATUS],
  'Keep In View': ['Offering Creation'],
  'On Boarding': ['Withdrawn'],
  [REJECTED_UI_STATUS]: [],
  Withdrawn: [],
};

/**
 * Returns the statuses selectable from `currentUiStatus` (always includes the current
 * status itself). Returns `null` when the current status isn't part of the managed
 * workflow, signaling callers to skip enforcement (keeps legacy data usable).
 */
function getAllowedNextStatuses(currentUiStatus) {
  const current = (currentUiStatus || 'Applied').toString().trim();
  const next = STATUS_TRANSITIONS[current];
  if (!next) return null;
  return Array.from(new Set([current, ...next]));
}

/** Transitions where the Interview Result must be filled in before the change is allowed. */
const INTERVIEW_RESULT_REQUIRED_TRANSITIONS = [
  { from: 'Interviewed', to: 'Document Verification' },
  { from: 'Interviewed', to: 'Assessment' },
];

function isInterviewResultRequired(fromUiStatus, toUiStatus) {
  return INTERVIEW_RESULT_REQUIRED_TRANSITIONS.some(
    (t) => t.from === fromUiStatus && t.to === toUiStatus
  );
}

/**
 * Validates a status change against the managed pipeline workflow. Throws an Error with
 * `statusCode = 400` when the transition (or missing Interview Result) isn't allowed.
 * No-ops for statuses outside the managed workflow, and when oldStatus === newStatus.
 */
function assertAllowedStatusTransition(oldStatus, newStatus, { hasInterviewResult = false } = {}) {
  if (!oldStatus || oldStatus === newStatus) return;

  const oldUi = mapApplicationStatusToPipelineUi(oldStatus);
  const newUi = mapApplicationStatusToPipelineUi(newStatus);

  const allowed = getAllowedNextStatuses(oldUi);
  if (allowed && !allowed.includes(newUi)) {
    const err = new Error(
      `Cannot change candidate status from "${oldUi}" to "${newUi}". Allowed next status(es): ${
        allowed.filter((s) => s !== oldUi).join(', ') || 'none'
      }.`
    );
    err.statusCode = 400;
    throw err;
  }

  if (isInterviewResultRequired(oldUi, newUi) && !hasInterviewResult) {
    const err = new Error(
      `Interview Result is required before moving this candidate from "${oldUi}" to "${newUi}".`
    );
    err.statusCode = 400;
    throw err;
  }
}

module.exports = {
  PRISMA_APP_STATUS_STRINGS,
  mapUiStatusToApplicationStatus,
  mapApplicationStatusToUi,
  mapApplicationStatusToPipelineUi,
  REJECTED_UI_STATUS,
  STATUS_TRANSITIONS,
  getAllowedNextStatuses,
  isInterviewResultRequired,
  assertAllowedStatusTransition,
};
