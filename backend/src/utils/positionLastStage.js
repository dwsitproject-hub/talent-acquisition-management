const {
  mapApplicationStatusToPipelineUi,
  REJECTED_UI_STATUS,
} = require('./applicationStatus');

/**
 * "Last stage" of a position = furthest non-terminal candidate in the hiring stepper.
 * Mirrors frontend/src/utils/applicationStatusUi.ts (getLatestPipelineProgress) so the
 * Position list filter matches the stage pill shown on each row.
 */

const TERMINAL_UI_STATUSES = new Set([REJECTED_UI_STATUS, 'Offer Rejected', 'Withdrawn']);

const PIPELINE_STATUS_RANK = [
  'Applied',
  'Under Review',
  'Shortlisted',
  'Interview Scheduled',
  'Interviewed',
  'Assessment',
  'Document Verification',
  'Offering Creation',
  'Offer Sent',
  'Pending Feedback',
  'Offer Accepted',
  'MCU',
  'On Boarding',
  'Hired',
];

const RANK_ALIASES = {
  'Medical Checkup Scheduled': 'MCU',
  'Contract Sent': 'On Boarding',
  'Contract Signed': 'On Boarding',
};

const KEEP_IN_VIEW = 'Keep In View';
/** Filter value for positions with no active (non-terminal) candidate. */
const NO_ACTIVE_CANDIDATE = '__none__';

/** Selectable values for the Last stage filter (canonical labels). */
const LAST_STAGE_OPTIONS = [...PIPELINE_STATUS_RANK, KEEP_IN_VIEW, NO_ACTIVE_CANDIDATE];

/**
 * @param {Array<string|null|undefined>} applicationStatuses raw Prisma ApplicationStatus values
 * @returns {string} canonical stage label, or NO_ACTIVE_CANDIDATE
 */
function getPositionLastStage(applicationStatuses) {
  let bestRank = -1;
  let hasKeepInView = false;

  for (const status of applicationStatuses || []) {
    const ui = mapApplicationStatusToPipelineUi(status);
    if (ui === KEEP_IN_VIEW) {
      hasKeepInView = true;
      continue;
    }
    if (TERMINAL_UI_STATUSES.has(ui)) continue;
    const rank = PIPELINE_STATUS_RANK.indexOf(RANK_ALIASES[ui] || ui);
    if (rank > bestRank) bestRank = rank;
  }

  if (bestRank >= 0) return PIPELINE_STATUS_RANK[bestRank];
  return hasKeepInView ? KEEP_IN_VIEW : NO_ACTIVE_CANDIDATE;
}

module.exports = {
  LAST_STAGE_OPTIONS,
  NO_ACTIVE_CANDIDATE,
  getPositionLastStage,
};
