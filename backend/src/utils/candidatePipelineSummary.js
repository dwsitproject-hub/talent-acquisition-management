const { businessDaysDiffIndonesia } = require('./indoBusinessDays');

/**
 * Per-candidate pipeline summary for the "Summary by Position" candidate drill-down.
 * Pure function — takes one application (with statusHistory) and returns the
 * Applied / Interview / Offer Decision / Join Date view model, including the
 * "SLA to Interview" and "SLA to Offer Decision" working-day counts.
 *
 * Design notes (see conversation / PRD discussion):
 * - "SLA to Interview" = Indonesia working days from appliedAt to the interview date.
 *   Interview date = earliest of INTERVIEW_SCHEDULED / INTERVIEW_COMPLETED history,
 *   falling back to the application.interviewedAt column.
 * - "SLA to Interview" is always populated once the candidate has a terminal
 *   interview-stage outcome, so rejections/withdrawals never show a blank SLA:
 *     - Rejected/withdrawn BEFORE ever being interviewed → SLA runs appliedAt → that
 *       rejection/withdrawal date (`slaBasis: 'rejection' | 'withdrawal'`).
 *     - Rejected/withdrawn AFTER being interviewed (e.g. failed a later stage like
 *       Assessment) → SLA still runs appliedAt → the interview date itself
 *       (`slaBasis: 'interview'`), since the interview gate was in fact cleared.
 *   The rejection/withdrawal date itself is shown in the Interview Result column,
 *   not as a separate up-front "Reject" column.
 * - "SLA to Offer Decision" = Indonesia working days from interview date to the
 *   offer accepted/rejected date (or to the withdrawal date, if withdrawn after
 *   interview but before a decision). Only meaningful once the candidate has
 *   passed the interview stage.
 * - While a stage is still in progress (no terminal date yet), the SLA is computed
 *   against `now` and flagged `pending: true` so the UI can show it as "so far"
 *   rather than a finalized duration.
 * - Interview Result "Interviewed": interview date is before today (calendar) and at
 *   least one interview row from the edit modal has results (`Interview.notes`).
 * - Interview Result "Passed": candidate reached `DOCUMENT_VERIFICATION` in history
 *   (cleared the interview gate for offer-stage columns).
 * - Join Date: `Application.joinDate` from the position edit modal when set (not gated
 *   on offer acceptance).
 */

const REJECTED_STATUS = 'REJECTED'; // "Rejected (Failed Interview / Assessment)"
const DOCUMENT_VERIFICATION_STATUS = 'DOCUMENT_VERIFICATION';

/** Earliest createdAt per toStatus from ascending-ordered status history. */
function buildFirstReachedMap(statusHistory) {
  const map = {};
  (statusHistory || []).forEach((h) => {
    const status = (h.toStatus || '').toString().toUpperCase();
    if (!status) return;
    if (!map[status]) map[status] = h.createdAt;
  });
  return map;
}

/** Latest createdAt per toStatus — used for terminal outcomes that can repeat (e.g. accept then withdraw). */
function buildLastReachedMap(statusHistory) {
  const map = {};
  (statusHistory || []).forEach((h) => {
    const status = (h.toStatus || '').toString().toUpperCase();
    if (status) map[status] = h.createdAt;
  });
  return map;
}

function toDateOrNull(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function slaDaysBetween(start, end) {
  if (!start || !end) return null;
  return businessDaysDiffIndonesia(start, end);
}

/** Calendar day strictly before `ref` (UTC midnight comparison). */
function isCalendarDateBefore(date, ref) {
  if (!date || !ref) return false;
  const d = new Date(date);
  const r = new Date(ref);
  d.setUTCHours(0, 0, 0, 0);
  r.setUTCHours(0, 0, 0, 0);
  return d.getTime() < r.getTime();
}

function hasInterviewResultFilled(application) {
  const interviews = application.interviews;
  if (!Array.isArray(interviews) || interviews.length === 0) return false;
  return interviews.some((iv) => (iv?.notes || '').toString().trim().length > 0);
}

function resolveInterviewDate(application, firstReached) {
  const fromHistory =
    toDateOrNull(firstReached.INTERVIEW_SCHEDULED) ||
    toDateOrNull(firstReached.INTERVIEW_COMPLETED) ||
    toDateOrNull(application.interviewedAt);

  if (fromHistory) return fromHistory;

  const interviews = application.interviews;
  if (!Array.isArray(interviews) || interviews.length === 0) return null;

  let earliest = null;
  for (const iv of interviews) {
    const scheduled = toDateOrNull(iv?.scheduledAt);
    if (!scheduled) continue;
    if (!earliest || scheduled.getTime() < earliest.getTime()) {
      earliest = scheduled;
    }
  }
  return earliest;
}

function interviewStageClearedForOffer(firstReached) {
  return Boolean(firstReached[DOCUMENT_VERIFICATION_STATUS]);
}

/**
 * @param {object} application - { appliedAt, interviewedAt, rejectedAt, withdrawnAt, joinDate,
 *   interviews?: [{ scheduledAt, notes }],
 *   statusHistory: [{ toStatus, createdAt }] (ascending) }
 * @param {{ now?: Date }} [options]
 */
function buildCandidatePipelineSummary(application, options = {}) {
  const now = options.now || new Date();
  const firstReached = buildFirstReachedMap(application.statusHistory);
  const lastReached = buildLastReachedMap(application.statusHistory);

  const appliedAt = toDateOrNull(application.appliedAt);

  const interviewDate = resolveInterviewDate(application, firstReached);
  const interviewResultExists = hasInterviewResultFilled(application);
  const clearedInterviewForOffer = interviewStageClearedForOffer(firstReached);

  const rejectedAt = toDateOrNull(firstReached[REJECTED_STATUS]) || toDateOrNull(application.rejectedAt);
  const withdrawnAt = toDateOrNull(lastReached.WITHDRAWN) || toDateOrNull(application.withdrawnAt);
  const offerSentDate = toDateOrNull(firstReached.OFFER_SENT);
  const lastOfferAcceptedAt = toDateOrNull(lastReached.OFFER_ACCEPTED);
  const lastOfferRejectedAt = toDateOrNull(lastReached.OFFER_REJECTED);
  const joinDate = toDateOrNull(application.joinDate);

  // --- Interview stage outcome ---
  let interview;
  if (rejectedAt) {
    interview = { outcome: 'rejected', date: rejectedAt };
  } else if (withdrawnAt && (!interviewDate || withdrawnAt <= interviewDate)) {
    interview = { outcome: 'withdrawn', date: withdrawnAt };
  } else if (clearedInterviewForOffer && interviewDate) {
    interview = { outcome: 'passed', date: interviewDate };
  } else if (
    interviewDate &&
    isCalendarDateBefore(interviewDate, now) &&
    interviewResultExists
  ) {
    interview = { outcome: 'interviewed', date: interviewDate };
  } else {
    interview = { outcome: 'pending', date: null };
  }

  // SLA to Interview always resolves to a value once the candidate has either been
  // interviewed OR exited the pipeline (rejected/withdrawn) — only genuinely open
  // applications (still being screened, no decision yet) get a "so far" running count.
  // `slaBasis` tells the UI what the end date actually represents, since a reject/
  // withdraw can land before interview (no interview ever happened) or after it
  // (interview happened, then the candidate was dropped at a later stage).
  let slaToInterviewDays = null;
  let slaToInterviewPending = false;
  let slaToInterviewBasis = null; // 'interview' | 'rejection' | 'withdrawal' | 'elapsed'

  if (
    (interview.outcome === 'passed' || interview.outcome === 'interviewed') &&
    appliedAt &&
    interviewDate
  ) {
    slaToInterviewDays = slaDaysBetween(appliedAt, interviewDate);
    slaToInterviewBasis = 'interview';
  } else if (interview.outcome === 'rejected' && appliedAt && rejectedAt) {
    const interviewHappenedFirst = interviewDate && interviewDate <= rejectedAt;
    const end = interviewHappenedFirst ? interviewDate : rejectedAt;
    slaToInterviewDays = slaDaysBetween(appliedAt, end);
    slaToInterviewBasis = interviewHappenedFirst ? 'interview' : 'rejection';
  } else if (interview.outcome === 'withdrawn' && appliedAt && withdrawnAt) {
    const interviewHappenedFirst = interviewDate && interviewDate <= withdrawnAt;
    const end = interviewHappenedFirst ? interviewDate : withdrawnAt;
    slaToInterviewDays = slaDaysBetween(appliedAt, end);
    slaToInterviewBasis = interviewHappenedFirst ? 'interview' : 'withdrawal';
  } else if (interview.outcome === 'pending' && appliedAt) {
    // Still awaiting a decision — show elapsed time so far, not a finalized SLA.
    slaToInterviewDays = slaDaysBetween(appliedAt, now);
    slaToInterviewPending = true;
    slaToInterviewBasis = 'elapsed';
  }

  // --- Offer stage outcome (only reachable once interview is passed) ---
  let offer = { outcome: 'not_applicable', date: null };
  let slaToOfferDecisionDays = null;
  let slaToOfferDecisionPending = false;

  if (interview.outcome === 'passed') {
    // Offer stage uses the *latest* terminal event so accept → withdraw still shows Withdrawn.
    const offerTerminalCandidates = [];
    if (lastOfferRejectedAt) {
      offerTerminalCandidates.push({ outcome: 'rejected', date: lastOfferRejectedAt });
    }
    if (lastOfferAcceptedAt) {
      offerTerminalCandidates.push({ outcome: 'accepted', date: lastOfferAcceptedAt });
    }
    if (withdrawnAt && interviewDate && withdrawnAt > interviewDate) {
      offerTerminalCandidates.push({ outcome: 'withdrawn', date: withdrawnAt });
    }

    if (offerTerminalCandidates.length > 0) {
      offerTerminalCandidates.sort((a, b) => b.date.getTime() - a.date.getTime());
      offer = {
        outcome: offerTerminalCandidates[0].outcome,
        date: offerTerminalCandidates[0].date,
      };
    } else if (offerSentDate) {
      offer = { outcome: 'pending', date: null };
    } else {
      offer = { outcome: 'not_yet', date: null };
    }

    const decisionEnd =
      offer.outcome === 'rejected'
        ? lastOfferRejectedAt
        : offer.outcome === 'accepted'
          ? lastOfferAcceptedAt
          : offer.outcome === 'withdrawn'
            ? withdrawnAt
            : null;

    if (decisionEnd && interviewDate) {
      slaToOfferDecisionDays = slaDaysBetween(interviewDate, decisionEnd);
    } else if (offer.outcome === 'pending' && interviewDate) {
      slaToOfferDecisionDays = slaDaysBetween(interviewDate, now);
      slaToOfferDecisionPending = true;
    }
  }

  return {
    appliedAt: appliedAt ? appliedAt.toISOString() : null,
    interview: {
      outcome: interview.outcome,
      date: interview.date ? interview.date.toISOString() : null,
      slaDays: slaToInterviewDays,
      slaPending: slaToInterviewPending,
      slaBasis: slaToInterviewBasis,
    },
    offer: {
      outcome: offer.outcome,
      sentDate: offerSentDate ? offerSentDate.toISOString() : null,
      date: offer.date ? offer.date.toISOString() : null,
      slaDays: slaToOfferDecisionDays,
      slaPending: slaToOfferDecisionPending,
    },
    joinDate: joinDate ? joinDate.toISOString() : null,
  };
}

module.exports = {
  buildCandidatePipelineSummary,
};
