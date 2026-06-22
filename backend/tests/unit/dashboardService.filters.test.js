const {
  buildAreaFilterCondition,
  buildFptkDateCondition,
  resolveNormalizedArea,
  getLocationKey,
} = require('../../src/services/dashboardService');

describe('dashboardService filter helpers', () => {
  describe('buildAreaFilterCondition', () => {
    it('returns null for ALL or empty', () => {
      expect(buildAreaFilterCondition('ALL')).toBeNull();
      expect(buildAreaFilterCondition('')).toBeNull();
      expect(buildAreaFilterCondition(undefined)).toBeNull();
    });

    it('builds HO filter with legacy Head Office fallback', () => {
      const cond = buildAreaFilterCondition('HO');
      expect(cond.OR).toHaveLength(2);
      expect(cond.OR[0].area.equals).toBe('HO');
      expect(cond.OR[1].AND[1].location.equals).toBe('Head Office');
    });

    it('builds Site filter with legacy location fallback', () => {
      const cond = buildAreaFilterCondition('Site');
      expect(cond.OR).toHaveLength(2);
      expect(cond.OR[0].area.equals).toBe('Site');
      expect(cond.OR[1].AND[1].location.equals).toBe('Site');
    });
  });

  describe('buildFptkDateCondition', () => {
    it('returns null for invalid dates', () => {
      expect(buildFptkDateCondition('', '')).toBeNull();
      expect(buildFptkDateCondition('bad', 'bad')).toBeNull();
    });

    it('returns OR on updatedAt and createdAt', () => {
      const start = '2025-06-01T00:00:00.000Z';
      const end = '2025-06-30T23:59:59.999Z';
      const cond = buildFptkDateCondition(start, end);
      expect(cond.OR).toHaveLength(2);
      expect(cond.OR[0].updatedAt.gte).toEqual(new Date(start));
      expect(cond.OR[1].createdAt.lte).toEqual(new Date(end));
    });
  });

  describe('resolveNormalizedArea', () => {
    it('prefers area column', () => {
      expect(resolveNormalizedArea({ area: 'HO', location: 'Head Office' })).toBe('HO');
    });

    it('falls back from location Head Office to HO', () => {
      expect(resolveNormalizedArea({ area: '', location: 'Head Office' })).toBe('HO');
    });

    it('falls back from location Site to Site', () => {
      expect(resolveNormalizedArea({ area: null, location: 'Site' })).toBe('Site');
    });
  });

  describe('getLocationKey', () => {
    it('uses areaDetail for display', () => {
      expect(getLocationKey({ areaDetail: 'Jakarta A', area: 'HO' })).toBe('Jakarta A');
    });

    it('does not use raw area code as location name', () => {
      expect(getLocationKey({ areaDetail: '', area: 'HO' })).toBe('Unassigned');
    });
  });
});
