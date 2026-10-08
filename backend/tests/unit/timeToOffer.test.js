const { buildTimeToOfferByFptkId } = require('../../src/utils/positionSla');

describe('buildTimeToOfferByFptkId', () => {
  it('measures applied → earliest offer acceptance from status history', () => {
    const apps = [
      { id: 'a1', fptkId: 'f1', status: 'ONBOARDING', appliedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-03-01T00:00:00Z' },
    ];
    const history = [
      { applicationId: 'a1', toStatus: 'CONTRACT_SIGNED', createdAt: '2026-01-25T00:00:00Z' },
      { applicationId: 'a1', toStatus: 'OFFER_ACCEPTED', createdAt: '2026-01-21T00:00:00Z' },
      { applicationId: 'a1', toStatus: 'INTERVIEW_SCHEDULED', createdAt: '2026-01-05T00:00:00Z' },
    ];
    expect(buildTimeToOfferByFptkId(apps, history)).toEqual({ f1: { hires: 1, totalDays: 13, acceptedAt: ['2026-01-21T00:00:00.000Z'] } });
  });

  it('falls back to updatedAt when an accepted application has no history', () => {
    const apps = [
      { id: 'a1', fptkId: 'f1', status: 'OFFER_ACCEPTED', appliedAt: '2026-02-01T00:00:00Z', updatedAt: '2026-02-11T00:00:00Z' },
    ];
    expect(buildTimeToOfferByFptkId(apps, [])).toEqual({ f1: { hires: 1, totalDays: 8, acceptedAt: ['2026-02-11T00:00:00.000Z'] } });
  });

  it('sums hires per position so averages can be hire-weighted', () => {
    const apps = [
      { id: 'a1', fptkId: 'f1', status: 'HIRED', appliedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-11T00:00:00Z' },
      { id: 'a2', fptkId: 'f1', status: 'ONBOARDING', appliedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-31T00:00:00Z' },
      { id: 'a3', fptkId: 'f1', status: 'INTERVIEW_SCHEDULED', appliedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-31T00:00:00Z' },
      { id: 'a4', fptkId: 'f2', status: 'REJECTED', appliedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-31T00:00:00Z' },
    ];
    expect(buildTimeToOfferByFptkId(apps, [])).toEqual({ f1: { hires: 2, totalDays: 26, acceptedAt: ['2026-01-11T00:00:00.000Z', '2026-01-31T00:00:00.000Z'] } });
  });

  it('counts a candidate who accepted then withdrew (history shows acceptance)', () => {
    const apps = [
      { id: 'a1', fptkId: 'f1', status: 'WITHDRAWN', appliedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-02-01T00:00:00Z' },
    ];
    const history = [{ applicationId: 'a1', toStatus: 'OFFER_ACCEPTED', createdAt: '2026-01-15T00:00:00Z' }];
    expect(buildTimeToOfferByFptkId(apps, history)).toEqual({ f1: { hires: 1, totalDays: 10, acceptedAt: ['2026-01-15T00:00:00.000Z'] } });
  });

  it('counts Indonesia working days only (Fri → Mon = 1)', () => {
    const apps = [
      { id: 'a1', fptkId: 'f1', status: 'OFFER_ACCEPTED', appliedAt: '2026-02-06T00:00:00Z', updatedAt: '2026-02-09T00:00:00Z' },
    ];
    expect(buildTimeToOfferByFptkId(apps, [])).toEqual({ f1: { hires: 1, totalDays: 1, acceptedAt: ['2026-02-09T00:00:00.000Z'] } });
  });

  it('ignores applications without appliedAt', () => {
    const apps = [{ id: 'a1', fptkId: 'f1', status: 'HIRED', appliedAt: null, updatedAt: '2026-01-11T00:00:00Z' }];
    expect(buildTimeToOfferByFptkId(apps, [])).toEqual({});
  });
});
