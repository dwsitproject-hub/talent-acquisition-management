const { getSlaBucketIndonesiaWorkingDays, businessDaysDiffIndonesia } = require('./indoBusinessDays');

function isFptkClosedByCurrentStatus(currentStatus) {
  const s = (currentStatus || '').trim().toLowerCase();
  return s === 'close' || s === 'cancel' || s === 'internal movement';
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
  getPositionSlaBucket,
  getPositionSlaWorkingDays,
  isFptkClosedByCurrentStatus,
};
