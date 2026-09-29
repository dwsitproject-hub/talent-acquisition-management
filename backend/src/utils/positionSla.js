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

/** Application statuses at or after offer acceptance — SLA stops counting from the earliest. */
const OFFER_ACCEPTANCE_SLA_FREEZE_STATUSES = [
  'OFFER_ACCEPTED',
  'MEDICAL_CHECKUP_SCHEDULED',
  'MEDICAL_CHECKUP_COMPLETED',
  'CONTRACT_SENT',
  'CONTRACT_SIGNED',
  'ONBOARDING',
  'HIRED',
];

function isFptkClosedByCurrentStatus(currentStatus) {
  const s = (currentStatus || '').trim().toLowerCase();
  return CLOSED_CURRENT_STATUSES.includes(s);
}

function isFptkOpenByCurrentStatus(currentStatus) {
  return !isFptkClosedByCurrentStatus(currentStatus);
}

function isOfferAcceptanceSlaFreezeStatus(status) {
  const raw = (status || '').toString().toUpperCase().trim();
  return OFFER_ACCEPTANCE_SLA_FREEZE_STATUSES.includes(raw);
}

/**
 * Earliest offer-acceptance moment per FPTK from status history (+ current-status fallback).
 * @returns {Record<string, Date>}
 */
function buildEarliestOfferAcceptanceAtByFptkId(applications, statusHistoryRows) {
  const appIdToFptkId = new Map();
  applications.forEach((app) => {
    if (app?.id && app?.fptkId) appIdToFptkId.set(app.id, app.fptkId);
  });

  /** @type {Record<string, Date>} */
  const byFptkId = {};

  const consider = (fptkId, dateValue) => {
    if (!fptkId || dateValue == null) return;
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (Number.isNaN(date.getTime())) return;
    const existing = byFptkId[fptkId];
    if (!existing || date.getTime() < existing.getTime()) {
      byFptkId[fptkId] = date;
    }
  };

  (statusHistoryRows || []).forEach((row) => {
    if (!isOfferAcceptanceSlaFreezeStatus(row.toStatus)) return;
    const fptkId = appIdToFptkId.get(row.applicationId);
    consider(fptkId, row.createdAt);
  });

  (applications || []).forEach((app) => {
    if (!app?.fptkId || !isOfferAcceptanceSlaFreezeStatus(app.status)) return;
    if (byFptkId[app.fptkId]) return;
    consider(app.fptkId, app.updatedAt);
  });

  return byFptkId;
}

/**
 * SLA end: earliest of offer acceptance, position close, or today (open pipeline).
 * Keep in sync with frontend `src/utils/positionSla.ts`.
 */
function resolveSlaEndDate(job, now = new Date()) {
  const nowDate = now instanceof Date ? now : new Date(now);
  const candidates = [];

  const offerRaw = job?.offerAcceptedAt ?? null;
  if (offerRaw) {
    const offerDate = new Date(offerRaw);
    if (!Number.isNaN(offerDate.getTime())) candidates.push(offerDate);
  }

  if (isFptkClosedByCurrentStatus(job?.currentStatus)) {
    const closeRaw = job?.closedAt ?? null;
    if (closeRaw) {
      const closeDate = new Date(closeRaw);
      if (!Number.isNaN(closeDate.getTime())) candidates.push(closeDate);
    } else {
      candidates.push(nowDate);
    }
  }

  if (candidates.length === 0) return nowDate;
  const minTime = Math.min(...candidates.map((d) => d.getTime()));
  return new Date(minTime);
}

/**
 * SLA bucket from FPTK receive date (fallback requestDate, createdAt).
 * Frozen at offer acceptance and/or closedAt when applicable.
 */
function getPositionSlaBucket(job, now = new Date()) {
  const referenceDate = job?.fptkReceiveDate || job?.requestDate || job?.createdAt;
  if (!referenceDate) return '-';

  const start = new Date(referenceDate);
  if (Number.isNaN(start.getTime())) return '-';

  const slaEndDate = resolveSlaEndDate(job, now);
  return getSlaBucketIndonesiaWorkingDays(start, slaEndDate);
}

function getPositionSlaWorkingDays(job, now = new Date()) {
  const referenceDate = job?.fptkReceiveDate || job?.requestDate || job?.createdAt;
  if (!referenceDate) return null;

  const start = new Date(referenceDate);
  if (Number.isNaN(start.getTime())) return null;

  const slaEndDate = resolveSlaEndDate(job, now);
  return businessDaysDiffIndonesia(start, slaEndDate);
}

module.exports = {
  CLOSED_CURRENT_STATUSES,
  OFFER_ACCEPTANCE_SLA_FREEZE_STATUSES,
  buildEarliestOfferAcceptanceAtByFptkId,
  getPositionSlaBucket,
  getPositionSlaWorkingDays,
  isFptkClosedByCurrentStatus,
  isFptkOpenByCurrentStatus,
  isOfferAcceptanceSlaFreezeStatus,
  resolveSlaEndDate,
};
