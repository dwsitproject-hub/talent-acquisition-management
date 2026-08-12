const { getSlaBucketIndonesiaWorkingDays, businessDaysDiffIndonesia } = require('./indoBusinessDays');

/**
 * Canonical Open/Closed classification — single source of truth for the backend.
 * Keep in sync with frontend `src/utils/fptkPositionStatus.ts`.
 *
 * Closed = terminal / exited pipeline: Close, Cancel(led), Internal Movement.
 * Open = all other currentStatus values (Open, Pending FKTK, Re-Open, Hold, empty, etc.)
 * so Open + Closed always equals Total.
 */
const CLOSED_CURRENT_STATUSES = ['close', 'cancel', 'cancelled', 'internal movement'];

function isFptkClosedByCurrentStatus(currentStatus) {
  const s = (currentStatus || '').trim().toLowerCase();
  return CLOSED_CURRENT_STATUSES.includes(s);
}

function isFptkOpenByCurrentStatus(currentStatus) {
  return !isFptkClosedByCurrentStatus(currentStatus);
}

/**
 * SLA bucket from FPTK receive date (fallback requestDate, createdAt).
 * Frozen at closedAt when position is closed — same as Summary by Position.
 */
function getPositionSlaBucket(job, now = new Date()) {
  const referenceDate = job?.fptkReceiveDate || job?.requestDate || job?.createdAt;
  if (!referenceDate) return '-';

  const start = new Date(referenceDate);
  if (Number.isNaN(start.getTime())) return '-';

  const isClosed = isFptkClosedByCurrentStatus(job?.currentStatus);
  const closeAnchorRaw = isClosed ? job?.closedAt || null : null;
  const closeAnchorDate = closeAnchorRaw ? new Date(closeAnchorRaw) : null;
  const slaEndDate =
    closeAnchorDate && !Number.isNaN(closeAnchorDate.getTime()) ? closeAnchorDate : now;

  return getSlaBucketIndonesiaWorkingDays(start, slaEndDate);
}

function getPositionSlaWorkingDays(job, now = new Date()) {
  const referenceDate = job?.fptkReceiveDate || job?.requestDate || job?.createdAt;
  if (!referenceDate) return null;

  const start = new Date(referenceDate);
  if (Number.isNaN(start.getTime())) return null;

  const isClosed = isFptkClosedByCurrentStatus(job?.currentStatus);
  const closeAnchorRaw = isClosed ? job?.closedAt || null : null;
  const closeAnchorDate = closeAnchorRaw ? new Date(closeAnchorRaw) : null;
  const slaEndDate =
    closeAnchorDate && !Number.isNaN(closeAnchorDate.getTime()) ? closeAnchorDate : now;

  return businessDaysDiffIndonesia(start, slaEndDate);
}

module.exports = {
  CLOSED_CURRENT_STATUSES,
  getPositionSlaBucket,
  getPositionSlaWorkingDays,
  isFptkClosedByCurrentStatus,
  isFptkOpenByCurrentStatus,
};
