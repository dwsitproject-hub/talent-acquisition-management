const {
  getAllowedNextStatuses,
  assertAllowedStatusTransition,
  createEmptySummaryByPositionCounts,
  addApplicationToSummaryByPositionCounts,
} = require('../../src/utils/applicationStatus');

describe('applicationStatus transitions', () => {
  it('allows Withdrawn from On Boarding', () => {
    const allowed = getAllowedNextStatuses('On Boarding');
    expect(allowed).toEqual(['On Boarding', 'Withdrawn']);
  });

  it('accepts ONBOARDING → WITHDRAWN', () => {
    expect(() => assertAllowedStatusTransition('ONBOARDING', 'WITHDRAWN')).not.toThrow();
  });

  it('rejects ONBOARDING → HIRED', () => {
    expect(() => assertAllowedStatusTransition('ONBOARDING', 'HIRED')).toThrow(
      /Cannot change candidate status from "On Boarding"/
    );
  });

  it('allows Offer Rejected from Offer Sent', () => {
    const allowed = getAllowedNextStatuses('Offer Sent');
    expect(allowed).toEqual(expect.arrayContaining(['Offer Sent', 'Offer Rejected']));
  });

  it('accepts OFFER_SENT → OFFER_REJECTED', () => {
    expect(() => assertAllowedStatusTransition('OFFER_SENT', 'OFFER_REJECTED')).not.toThrow();
  });
});

describe('summary by position column counts', () => {
  it('counts each candidate once per column even with multiple interview stages', () => {
    const counts = createEmptySummaryByPositionCounts();
    addApplicationToSummaryByPositionCounts(
      counts,
      new Set(['SUBMITTED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'TECHNICAL_TEST'])
    );
    expect(counts.applied).toBe(1);
    expect(counts.interview).toBe(1);
    expect(counts.offerSent).toBe(0);
  });

  it('maps offer sent using pipeline labels (not collapsed Under Review)', () => {
    const counts = createEmptySummaryByPositionCounts();
    addApplicationToSummaryByPositionCounts(counts, new Set(['OFFER_SENT']));
    expect(counts.offerSent).toBe(1);
  });
});
