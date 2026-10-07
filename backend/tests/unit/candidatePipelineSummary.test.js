const { buildCandidatePipelineSummary } = require('../../src/utils/candidatePipelineSummary');

function iso(daysFromEpoch) {
  // Helper: deterministic UTC dates, spaced out so weekday/weekend doesn't matter for ordering tests.
  return new Date(Date.UTC(2025, 0, 1 + daysFromEpoch)).toISOString();
}

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

  it('computes SLA to Interview once interview is reached, and leaves offer stage not_yet', () => {
    const result = buildCandidatePipelineSummary({
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
    });

    expect(result.interview.outcome).toBe('passed');
    expect(result.interview.date).toBe(iso(5));
    expect(result.interview.slaDays).toBeGreaterThan(0);
    expect(result.offer.outcome).toBe('not_yet');
    expect(result.offer.slaDays).toBeNull();
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
    // Interview did happen before rejection — SLA still measures appliedAt → interview date.
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
        { toStatus: 'SCREENING', createdAt: iso(2) },
        { toStatus: 'REJECTED', createdAt: iso(4) },
      ],
    });

    expect(result.interview.outcome).toBe('rejected');
    expect(result.interview.date).toBe(iso(4));
    // No interview ever happened — SLA measures appliedAt → rejection date instead.
    expect(result.interview.slaDays).not.toBeNull();
    expect(result.interview.slaBasis).toBe('rejection');
    expect(result.offer.outcome).toBe('not_applicable');
  });

  it('computes SLA to Offer Decision from interview date to offer acceptance, with join date', () => {
    const result = buildCandidatePipelineSummary({
      appliedAt: iso(0),
      interviewedAt: null,
      rejectedAt: null,
      withdrawnAt: null,
      joinDate: iso(30),
      statusHistory: [
        { toStatus: 'SUBMITTED', createdAt: iso(0) },
        { toStatus: 'INTERVIEW_SCHEDULED', createdAt: iso(5) },
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

  it('does not expose a join date when the offer was rejected', () => {
    const result = buildCandidatePipelineSummary({
      appliedAt: iso(0),
      interviewedAt: null,
      rejectedAt: null,
      withdrawnAt: null,
      joinDate: null,
      statusHistory: [
        { toStatus: 'INTERVIEW_SCHEDULED', createdAt: iso(5) },
        { toStatus: 'OFFER_SENT', createdAt: iso(12) },
        { toStatus: 'OFFER_REJECTED', createdAt: iso(14) },
      ],
    });

    expect(result.offer.outcome).toBe('rejected');
    expect(result.offer.date).toBe(iso(14));
    expect(result.joinDate).toBeNull();
  });

  it('attributes withdrawal to the offer stage when it happens after the interview', () => {
    const result = buildCandidatePipelineSummary({
      appliedAt: iso(0),
      interviewedAt: null,
      rejectedAt: null,
      withdrawnAt: iso(13),
      joinDate: null,
      statusHistory: [
        { toStatus: 'INTERVIEW_SCHEDULED', createdAt: iso(5) },
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
        { toStatus: 'OFFER_SENT', createdAt: iso(12) },
        { toStatus: 'OFFER_ACCEPTED', createdAt: iso(15) },
        { toStatus: 'WITHDRAWN', createdAt: iso(20) },
      ],
    });

    expect(result.offer.outcome).toBe('withdrawn');
    expect(result.offer.date).toBe(iso(20));
    expect(result.offer.slaDays).toBeGreaterThan(0);
    expect(result.joinDate).toBeNull();
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
