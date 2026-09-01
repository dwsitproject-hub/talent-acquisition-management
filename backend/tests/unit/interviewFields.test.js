const {
  buildInterviewerLookupWhere,
  parseInterviewScheduledAt,
} = require('../../src/utils/interviewFields');

describe('buildInterviewerLookupWhere', () => {
  it('returns null for empty input', () => {
    expect(buildInterviewerLookupWhere('')).toBeNull();
    expect(buildInterviewerLookupWhere('   ')).toBeNull();
  });

  it('does not match on first-name contains (Dani Tamin must not hit Dani Gordon)', () => {
    const where = buildInterviewerLookupWhere('Dani Tamin');
    const serialized = JSON.stringify(where);

    expect(serialized).not.toMatch(/contains/);
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { email: { equals: 'Dani Tamin', mode: 'insensitive' } },
        {
          AND: [
            { firstName: { equals: 'Dani', mode: 'insensitive' } },
            { lastName: { equals: 'Tamin', mode: 'insensitive' } },
          ],
        },
      ])
    );
  });

  it('does not match a single given name to any firstName (Dani must not hit Dani Gordon)', () => {
    const where = buildInterviewerLookupWhere('Dani');
    expect(where.OR).toEqual([{ email: { equals: 'Dani', mode: 'insensitive' } }]);
  });
});

describe('parseInterviewScheduledAt', () => {
  it('returns null when date is missing so callers do not invent a calendar day', () => {
    expect(parseInterviewScheduledAt('', '10:00')).toBeNull();
    expect(parseInterviewScheduledAt(null, '10:00')).toBeNull();
  });

  it('stores date and time as UTC calendar values', () => {
    const scheduled = parseInterviewScheduledAt('2026-09-01', '14:30');
    expect(scheduled.toISOString()).toBe('2026-09-01T14:30:00.000Z');
  });

  it('defaults missing time to 00:00 UTC without shifting the date', () => {
    const scheduled = parseInterviewScheduledAt('2026-09-01', '');
    expect(scheduled.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });
});
