jest.mock('../../src/config/database', () => ({}));
jest.mock('../../src/utils/logger', () => ({
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));
jest.mock('../../src/utils/candidateApplicationLock', () => ({
  assertCandidateCanApplyToPosition: jest.fn(),
}));

const {
  assertRequestedFptkIdsAreInScope,
} = require('../../src/utils/candidatePositionSync');

describe('assertRequestedFptkIdsAreInScope', () => {
  const siteId = '11111111-1111-1111-1111-111111111111';
  const hoId = '22222222-2222-2222-2222-222222222222';

  it('allows empty requests', () => {
    expect(() => assertRequestedFptkIdsAreInScope([], [siteId])).not.toThrow();
    expect(() => assertRequestedFptkIdsAreInScope([], [])).not.toThrow();
  });

  it('allows FPTK ids inside the assigned scope', () => {
    expect(() => assertRequestedFptkIdsAreInScope([siteId], [siteId])).not.toThrow();
  });

  it('rejects HO / out-of-scope FPTK ids', () => {
    try {
      assertRequestedFptkIdsAreInScope([hoId], [siteId]);
      throw new Error('expected 403');
    } catch (err) {
      expect(err.statusCode).toBe(403);
      expect(String(err.message)).toMatch(/assigned PT, Site area, and Area Detail/i);
    }
  });

  it('rejects a mixed list that includes any out-of-scope id', () => {
    try {
      assertRequestedFptkIdsAreInScope([siteId, hoId], [siteId]);
      throw new Error('expected 403');
    } catch (err) {
      expect(err.statusCode).toBe(403);
    }
  });
});
