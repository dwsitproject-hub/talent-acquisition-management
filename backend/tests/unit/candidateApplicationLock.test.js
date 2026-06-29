const {
  BLOCK_NEW_APPLICATION_STATUSES,
  applyExcludeHiredCandidates,
  buildExcludeHiredCandidatesCondition,
  lockFieldsFromBlocking,
  buildCandidateLockError,
  attachApplicationLockFields,
} = require('../../src/utils/candidateApplicationLock');

describe('candidateApplicationLock', () => {
  test('BLOCK_NEW_APPLICATION_STATUSES includes ONBOARDING and HIRED', () => {
    expect(BLOCK_NEW_APPLICATION_STATUSES).toEqual(['ONBOARDING', 'HIRED']);
  });

  test('buildExcludeHiredCandidatesCondition excludes HIRED and ONBOARDING applications', () => {
    expect(buildExcludeHiredCandidatesCondition()).toEqual({
      NOT: {
        applications: {
          some: {
            status: { in: ['ONBOARDING', 'HIRED'] },
          },
        },
      },
    });
  });

  test('applyExcludeHiredCandidates merges with existing role scope', () => {
    const where = {
      isDeleted: false,
      applications: { some: { fptk: { area: 'HO' } } },
    };
    applyExcludeHiredCandidates(where);
    expect(where).toEqual({
      isDeleted: false,
      applications: { some: { fptk: { area: 'HO' } } },
      NOT: {
        applications: {
          some: {
            status: { in: ['ONBOARDING', 'HIRED'] },
          },
        },
      },
    });
  });

  test('applyExcludeHiredCandidates wraps existing OR in AND', () => {
    const where = { OR: [{ email: { contains: 'a' } }] };
    applyExcludeHiredCandidates(where);
    expect(where.AND).toHaveLength(2);
    expect(where.AND[0]).toEqual({ OR: [{ email: { contains: 'a' } }] });
    expect(where.AND[1].NOT.applications.some.status.in).toEqual(['ONBOARDING', 'HIRED']);
  });

  test('lockFieldsFromBlocking returns unlocked when no blocking app', () => {
    expect(lockFieldsFromBlocking(null)).toEqual({
      isLockedForOtherPositions: false,
      lockReason: null,
      lockedApplicationFptkId: null,
      lockedPositionTitle: null,
    });
  });

  test('lockFieldsFromBlocking returns locked fields from blocking app', () => {
    expect(
      lockFieldsFromBlocking({
        fptkId: 'fptk-1',
        status: 'ONBOARDING',
        fptk: { positionTitle: 'Software Engineer' },
      })
    ).toEqual({
      isLockedForOtherPositions: true,
      lockReason: 'ONBOARDING',
      lockedApplicationFptkId: 'fptk-1',
      lockedPositionTitle: 'Software Engineer',
    });
  });

  test('buildCandidateLockError includes position title and status code', () => {
    const err = buildCandidateLockError({
      fptkId: 'fptk-1',
      status: 'ONBOARDING',
      fptk: { position: 'Analyst' },
    });
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CANDIDATE_LOCKED_FOR_OTHER_POSITION');
    expect(err.message).toContain('Analyst');
    expect(err.message).toContain('Withdrawn');
  });

  test('attachApplicationLockFields merges lock state onto candidate', () => {
    const blockingMap = new Map([
      [
        'cand-1',
        {
          fptkId: 'fptk-2',
          status: 'HIRED',
          fptk: { positionTitle: 'Manager' },
        },
      ],
    ]);

    const result = attachApplicationLockFields({ id: 'cand-1', name: 'Jane' }, blockingMap);
    expect(result.name).toBe('Jane');
    expect(result.isLockedForOtherPositions).toBe(true);
    expect(result.lockReason).toBe('HIRED');
    expect(result.lockedPositionTitle).toBe('Manager');
  });
});
