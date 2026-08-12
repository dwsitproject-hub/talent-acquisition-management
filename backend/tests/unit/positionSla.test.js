const { getPositionSlaBucket, getPositionSlaWorkingDays } = require('../../src/utils/positionSla');

describe('positionSla', () => {
  it('assigns 31-60 Days bucket using Indonesia working days', () => {
    const job = {
      fptkReceiveDate: '2026-02-01T00:00:00.000Z',
      currentStatus: 'Open',
      closedAt: null,
    };
    const now = new Date('2026-04-01T00:00:00.000Z');
    expect(getPositionSlaBucket(job, now)).toBe('31-60 Days');
    expect(getPositionSlaWorkingDays(job, now)).toBeGreaterThan(30);
    expect(getPositionSlaWorkingDays(job, now)).toBeLessThanOrEqual(60);
  });

  it('freezes SLA at closedAt for closed positions', () => {
    const job = {
      fptkReceiveDate: '2025-10-01T00:00:00.000Z',
      currentStatus: 'Close',
      closedAt: '2025-12-15T00:00:00.000Z',
    };
    const later = new Date('2026-06-01T00:00:00.000Z');
    expect(getPositionSlaBucket(job, later)).toBe('31-60 Days');
  });
});
