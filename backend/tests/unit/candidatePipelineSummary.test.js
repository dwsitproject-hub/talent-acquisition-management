const { buildCandidatePipelineSummary } = require('../../src/utils/candidatePipelineSummary');

function iso(daysFromEpoch) {
  // Helper: deterministic UTC dates, spaced out so weekday/weekend doesn't matter for ordering tests.
  return new Date(Date.UTC(2025, 0, 1 + daysFromEpoch)).toISOString();
}

const FIXED_NOW = new Date(Date.UTC(2025, 0, 20));

describe('buildCandidatePipelineSummary', () => {
  it('marks interview as pending with no SLA finalized while still in early screening', () => {
    const result = buildCandidatePipelineSummary(
      {
        appliedAt: iso(0),
        interviewedAt: null,
        rejectedAt: null,
        withdrawnAt: null,
        joinDate: null,
        statusHistory: [{ toStatus: 'SUBMITTED', createdAt: iso(0) }],
      },
      { now: new Date(Date.UTC(2025, 0, 10)) }
    );

    expect(result.interview.outcome).toBe('pending');
    expect(result.interview.slaPending).toBe(true);
    expect(result.interview.slaDays).toBeGreaterThan(0);
    expect(result.offer.outcome).toBe('not_applicable');
    expect(result.offer.slaDays).toBeNull();
  });

  it('stays pending after interview is scheduled until results exist and doc verification clears the gate', () => {
    const result = buildCandidatePipelineSummary(
      {
        appliedAt: iso(0),
        interviewedAt: null,
        rejectedAt: null,
        withdrawnAt: null,
        joinDate: null,
        statusHistory: [
          { toStatus: 'SUBMITTED', createdAt: iso(0) },
          { toStatus: 'SCREENING', createdAt: iso(1) },
          { toStatus: 'INTERVIEW_SCHEDULED', createdAt: iso(5) },
        ],
      },
      { now: FIXED_NOW }
    );

    expect(result.interview.outcome).toBe('pending');
    expect(result.offer.outcome).toBe('not_applicable');
    expect(result.offer.slaDays).toBeNull();
  });

  it('shows interviewed when interview date is in the past and edit-modal results exist', () => {
    const result = buildCandidatePipelineSummary(
      {
        appliedAt: iso(0),
        interviewedAt: null,
        rejectedAt: null,
        withdrawnAt: null,
        joinDate: null,
        statusHistory: [
          { toStatus: 'SUBMITTED', createdAt: iso(0) },
          { toStatus: 'INTERVIEW_SCHEDULED', createdAt: iso(5) },
        ],
        interviews: [{ scheduledAt: iso(5), notes: 'Strong communication skills' }],
      },
      { now: FIXED_NOW }
    );

    expect(result.interview.outcome).toBe('interviewed');
    expect(result.interview.date).toBe(iso(5));
    expect(result.interview.slaDays).toBeGreaterThan(0);
    expect(result.interview.slaBasis).toBe('interview');
    expect(result.offer.outcome).toBe('not_applicable');
  });

  it('shows passed once Document Verification is reached in history', () => {
    const result = buildCandidatePipelineSummary(
      {
        appliedAt: iso(0),
        interviewedAt: null,
        rejectedAt: null,
        withdrawnAt: null,
        joinDate: null,
        statusHistory: [
          { toStatus: 'SUBMITTED', createdAt: iso(0) },
          { toStatus: 'INTERVIEW_SCHEDULED', createdAt: iso(5) },
          { toStatus: 'DOCUMENT_VERIFICATION', createdAt: iso(8) },
        ],
        interviews: [{ scheduledAt: iso(5), notes: 'Proceed to doc check' }],
      },
      { now: FIXED_NOW }
    );

    expect(result.interview.outcome).toBe('passed');
    expect(result.interview.date).toBe(iso(5));
    expect(result.offer.outcome).toBe('not_yet');
  });

  it('keeps SLA to Interview (basis: interview) when rejected after the interview already happened', () => {
    const result = buildCandidatePipelineSummary({
      appliedAt: iso(0),
      interviewedAt: null,
      rejectedAt: iso(7),
      withdrawnAt: null,
      joinDate: null,
      statusHistory: [
        { toStatus: 'SUBMITTED', createdAt: iso(0) },
        { toStatus: 'INTERVIEW_SCHEDULED', createdAt: iso(3) },
        { toStatus: 'REJECTED', createdAt: iso(7) },
      ],
    });

    expect(result.interview.outcome).toBe('rejected');
    expect(result.interview.date).toBe(iso(7));
    expect(result.interview.slaDays).not.toBeNull();
    expect(result.interview.slaBasis).toBe('interview');
    expect(result.interview.slaPending).toBe(false);
    expect(result.offer.outcome).toBe('not_applicable');
  });

  it('shows SLA to Interview (basis: rejection) when rejected before ever being interviewed', () => {
    const result = buildCandidatePipelineSummary({
      appliedAt: iso(0),
      interviewedAt: null,
      rejectedAt: iso(4),
      withdrawnAt: null,
      joinDate: null,
      statusHistory: [
        { toStatus: 'SUBMITTED', createdAt: iso(0) },
        { toStatus: 'REJECTED', createdAt: iso(4) },
      ],
    });

    expect(result.interview.outcome).toBe('rejected');
    expect(result.interview.slaDays).not.toBeNull();
    expect(result.interview.slaBasis).toBe('rejection');
    expect(result.offer.outcome).toBe('not_applicable');
  });

  it('computes SLA to Offer Decision from interview date to offer acceptance, with join date from application', () => {
    const result = buildCandidatePipelineSummary({
      appliedAt: iso(0),
      interviewedAt: null,
      rejectedAt: null,
      withdrawnAt: null,
      joinDate: iso(30),
      statusHistory: [
        { toStatus: 'SUBMITTED', createdAt: iso(0) },
        { toStatus: 'INTERVIEW_SCHEDULED', createdAt: iso(5) },
        { toStatus: 'DOCUMENT_VERIFICATION', createdAt: iso(6) },
        { toStatus: 'OFFER_SENT', createdAt: iso(12) },
        { toStatus: 'OFFER_ACCEPTED', createdAt: iso(15) },
      ],
    });

    expect(result.interview.outcome).toBe('passed');
    expect(result.offer.outcome).toBe('accepted');
    expect(result.offer.date).toBe(iso(15));
    expect(result.offer.sentDate).toBe(iso(12));
    expect(result.offer.slaDays).toBeGreaterThan(0);
    expect(result.joinDate).toBe(iso(30));
  });

  it('exposes join date from the application when set, even if offer was rejected', () => {
    const result = buildCandidatePipelineSummary({
      appliedAt: iso(0),
      interviewedAt: null,
      rejectedAt: null,
      withdrawnAt: null,
      joinDate: iso(25),
      statusHistory: [
        { toStatus: 'INTERVIEW_SCHEDULED', createdAt: iso(5) },
        { toStatus: 'DOCUMENT_VERIFICATION', createdAt: iso(6) },
        { toStatus: 'OFFER_SENT', createdAt: iso(12) },
        { toStatus: 'OFFER_REJECTED', createdAt: iso(14) },
      ],
    });

    expect(result.offer.outcome).toBe('rejected');
    expect(result.offer.date).toBe(iso(14));
    expect(result.joinDate).toBe(iso(25));
  });

  it('attributes withdrawal to the offer stage when it happens after the interview gate is cleared', () => {
    const result = buildCandidatePipelineSummary({
      appliedAt: iso(0),
      interviewedAt: null,
      rejectedAt: null,
      withdrawnAt: iso(13),
      joinDate: null,
      statusHistory: [
        { toStatus: 'INTERVIEW_SCHEDULED', createdAt: iso(5) },
        { toStatus: 'DOCUMENT_VERIFICATION', createdAt: iso(6) },
        { toStatus: 'OFFER_SENT', createdAt: iso(10) },
        { toStatus: 'WITHDRAWN', createdAt: iso(13) },
      ],
    });

    expect(result.interview.outcome).toBe('passed');
    expect(result.offer.outcome).toBe('withdrawn');
    expect(result.offer.date).toBe(iso(13));
  });

  it('shows withdrawn (not accepted) when offer was accepted then candidate withdrew', () => {
    const result = buildCandidatePipelineSummary({
      appliedAt: iso(0),
      interviewedAt: null,
      rejectedAt: null,
      withdrawnAt: iso(20),
      joinDate: iso(30),
      statusHistory: [
        { toStatus: 'INTERVIEW_SCHEDULED', createdAt: iso(5) },
        { toStatus: 'DOCUMENT_VERIFICATION', createdAt: iso(6) },
        { toStatus: 'OFFER_SENT', createdAt: iso(12) },
        { toStatus: 'OFFER_ACCEPTED', createdAt: iso(15) },
        { toStatus: 'WITHDRAWN', createdAt: iso(20) },
      ],
    });

    expect(result.offer.outcome).toBe('withdrawn');
    expect(result.offer.date).toBe(iso(20));
    expect(result.offer.slaDays).toBeGreaterThan(0);
    expect(result.joinDate).toBe(iso(30));
  });

  it('attributes withdrawal to the interview stage when it happens before any interview', () => {
    const result = buildCandidatePipelineSummary({
      appliedAt: iso(0),
      interviewedAt: null,
      rejectedAt: null,
      withdrawnAt: iso(2),
      joinDate: null,
      statusHistory: [{ toStatus: 'WITHDRAWN', createdAt: iso(2) }],
    });

    expect(result.interview.outcome).toBe('withdrawn');
    expect(result.interview.date).toBe(iso(2));
    expect(result.interview.slaDays).not.toBeNull();
    expect(result.interview.slaBasis).toBe('withdrawal');
    expect(result.offer.outcome).toBe('not_applicable');
  });
});
