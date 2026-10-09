const {
  MAX_ONBOARDING_PER_POSITION,
  isEnteringOnboarding,
  buildPositionOnboardingLimitError,
  lockPositionForOnboardingTx,
  assertPositionCanAcceptOnboarding,
  assertPositionOnboardingLimitAfterSyncTx,
} = require('../../src/utils/positionOnboardingLimit');

function onboardingApp(id, firstName = 'Budi', lastName = 'Santoso') {
  return {
    id,
    candidateId: `cand-${id}`,
    fptkId: 'fptk-1',
    candidate: { user: { firstName, lastName } },
    fptk: { positionTitle: 'Mechanic', position: 'Mechanic' },
  };
}

describe('positionOnboardingLimit', () => {
  test('allows exactly one On Boarding candidate per position', () => {
    expect(MAX_ONBOARDING_PER_POSITION).toBe(1);
  });

  test('isEnteringOnboarding only for transitions into ONBOARDING', () => {
    expect(isEnteringOnboarding('CONTRACT_SIGNED', 'ONBOARDING')).toBe(true);
    expect(isEnteringOnboarding(undefined, 'ONBOARDING')).toBe(true);
    expect(isEnteringOnboarding('ONBOARDING', 'ONBOARDING')).toBe(false);
    expect(isEnteringOnboarding('ONBOARDING', 'WITHDRAWN')).toBe(false);
  });

  test('buildPositionOnboardingLimitError is a 409 with the incumbent candidate', () => {
    const err = buildPositionOnboardingLimitError(onboardingApp('app-1'));
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('POSITION_ONBOARDING_LIMIT_REACHED');
    expect(err.message).toContain('"Mechanic"');
    expect(err.message).toContain('"Budi Santoso"');
    expect(err.details).toEqual({
      fptkId: 'fptk-1',
      positionTitle: 'Mechanic',
      onboardingApplicationId: 'app-1',
      onboardingCandidateId: 'cand-app-1',
      onboardingCandidateName: 'Budi Santoso',
    });
  });

  test('error code is not mistaken for a Prisma error code', () => {
    expect(/^P\d{4}$/.test(buildPositionOnboardingLimitError(null).code)).toBe(false);
  });

  test('lockPositionForOnboardingTx row-locks the fptk', async () => {
    const tx = { $queryRaw: jest.fn().mockResolvedValue([]) };
    await lockPositionForOnboardingTx(tx, 'fptk-1');
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    const [strings, id] = tx.$queryRaw.mock.calls[0];
    expect(strings.join('?')).toBe('SELECT id FROM fptk WHERE id = ? FOR UPDATE');
    expect(id).toBe('fptk-1');
  });

  describe('assertPositionCanAcceptOnboarding', () => {
    test('passes when no other application is On Boarding', async () => {
      const db = { application: { findFirst: jest.fn().mockResolvedValue(null) } };
      await expect(assertPositionCanAcceptOnboarding(db, 'fptk-1', 'app-2')).resolves.toBeUndefined();
      expect(db.application.findFirst.mock.calls[0][0].where).toEqual({
        fptkId: 'fptk-1',
        status: 'ONBOARDING',
        id: { not: 'app-2' },
      });
    });

    test('throws 409 when another application is already On Boarding', async () => {
      const db = { application: { findFirst: jest.fn().mockResolvedValue(onboardingApp('app-1')) } };
      await expect(assertPositionCanAcceptOnboarding(db, 'fptk-1', 'app-2')).rejects.toMatchObject({
        statusCode: 409,
        code: 'POSITION_ONBOARDING_LIMIT_REACHED',
      });
    });
  });

  describe('assertPositionOnboardingLimitAfterSyncTx', () => {
    test('skips the check when nobody entered On Boarding (legacy duplicates stay saveable)', async () => {
      const tx = { application: { findMany: jest.fn() } };
      await assertPositionOnboardingLimitAfterSyncTx(tx, 'fptk-1', []);
      expect(tx.application.findMany).not.toHaveBeenCalled();
    });

    test('passes when the position ends with one On Boarding candidate', async () => {
      const tx = { application: { findMany: jest.fn().mockResolvedValue([onboardingApp('app-2')]) } };
      await expect(assertPositionOnboardingLimitAfterSyncTx(tx, 'fptk-1', ['app-2'])).resolves.toBeUndefined();
    });

    test('throws naming the existing candidate when a second one enters On Boarding', async () => {
      const tx = {
        application: {
          findMany: jest.fn().mockResolvedValue([
            onboardingApp('app-1', 'Existing', 'Hire'),
            onboardingApp('app-2', 'New', 'Hire'),
          ]),
        },
      };
      await expect(assertPositionOnboardingLimitAfterSyncTx(tx, 'fptk-1', ['app-2'])).rejects.toMatchObject({
        statusCode: 409,
        code: 'POSITION_ONBOARDING_LIMIT_REACHED',
        details: expect.objectContaining({ onboardingApplicationId: 'app-1', onboardingCandidateName: 'Existing Hire' }),
      });
    });

    test('throws when two candidates enter On Boarding in the same save', async () => {
      const tx = {
        application: {
          findMany: jest.fn().mockResolvedValue([onboardingApp('app-1'), onboardingApp('app-2')]),
        },
      };
      await expect(
        assertPositionOnboardingLimitAfterSyncTx(tx, 'fptk-1', ['app-1', 'app-2'])
      ).rejects.toMatchObject({ code: 'POSITION_ONBOARDING_LIMIT_REACHED' });
    });
  });
});
