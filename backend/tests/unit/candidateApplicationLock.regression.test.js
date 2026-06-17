const {
  assertCandidateCanApplyToPosition,
  enrichCandidateWithApplicationLock,
  enrichCandidatesWithApplicationLock,
  findBlockingApplication,
} = require('../../src/utils/candidateApplicationLock');

function mockDb(blockingRows = []) {
  return {
    application: {
      findFirst: jest.fn(async ({ where }) => {
        const match = blockingRows.find(
          (row) =>
            row.candidateId === where.candidateId &&
            (where.fptkId?.not ? row.fptkId !== where.fptkId.not : true)
        );
        return match || null;
      }),
      findMany: jest.fn(async ({ where }) =>
        blockingRows.filter(
          (row) =>
            where.candidateId.in.includes(row.candidateId) &&
            (where.fptkId?.not ? row.fptkId !== where.fptkId.not : true)
        )
      ),
    },
  };
}

describe('candidateApplicationLock regression', () => {
  test('does not block when candidate has no ONBOARDING/HIRED applications', async () => {
    const db = mockDb([]);
    await expect(assertCandidateCanApplyToPosition(db, 'c1', 'fptk-b')).resolves.toBeUndefined();
  });

  test('does not block when blocking app is on the same target FPTK (status update path)', async () => {
    const db = mockDb([
      {
        candidateId: 'c1',
        fptkId: 'fptk-a',
        status: 'ONBOARDING',
        fptk: { positionTitle: 'Engineer A' },
      },
    ]);
    await expect(assertCandidateCanApplyToPosition(db, 'c1', 'fptk-a')).resolves.toBeUndefined();
  });

  test('blocks when candidate is ONBOARDING on a different FPTK', async () => {
    const db = mockDb([
      {
        candidateId: 'c1',
        fptkId: 'fptk-a',
        status: 'ONBOARDING',
        fptk: { positionTitle: 'Engineer A' },
      },
    ]);
    await expect(assertCandidateCanApplyToPosition(db, 'c1', 'fptk-b')).rejects.toMatchObject({
      statusCode: 409,
      code: 'CANDIDATE_LOCKED_FOR_OTHER_POSITION',
    });
  });

  test('does not block when only REJECTED/WITHDRAWN apps exist (not in blocking set)', async () => {
    const db = mockDb([]);
    await expect(assertCandidateCanApplyToPosition(db, 'c1', 'fptk-b')).resolves.toBeUndefined();
    expect(db.application.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['ONBOARDING', 'HIRED'] },
        }),
      })
    );
  });

  test('enrichCandidatesWithApplicationLock adds unlocked defaults for normal candidates', async () => {
    const db = mockDb([]);
    const result = await enrichCandidatesWithApplicationLock(
      [{ id: 'c1', user: { firstName: 'A' } }],
      'fptk-b',
      db
    );
    expect(result[0].isLockedForOtherPositions).toBe(false);
    expect(result[0].user.firstName).toBe('A');
  });

  test('enrichCandidatesWithApplicationLock is no-op for empty list', async () => {
    const db = mockDb([]);
    expect(await enrichCandidatesWithApplicationLock([], 'fptk-b', db)).toEqual([]);
    expect(db.application.findMany).not.toHaveBeenCalled();
  });

  test('enrichCandidateWithApplicationLock preserves existing fields', async () => {
    const db = mockDb([
      {
        candidateId: 'c1',
        fptkId: 'fptk-a',
        status: 'HIRED',
        fptk: { position: 'Manager' },
      },
    ]);
    const result = await enrichCandidateWithApplicationLock(
      { id: 'c1', skills: ['Java'] },
      'fptk-b',
      db
    );
    expect(result.skills).toEqual(['Java']);
    expect(result.isLockedForOtherPositions).toBe(true);
    expect(result.lockReason).toBe('HIRED');
    expect(result.lockedPositionTitle).toBe('Manager');
  });

  test('findBlockingApplication returns null without candidateId', async () => {
    const db = mockDb([
      {
        candidateId: 'c1',
        fptkId: 'fptk-a',
        status: 'ONBOARDING',
        fptk: { positionTitle: 'X' },
      },
    ]);
    await expect(findBlockingApplication(db, null, 'fptk-b')).resolves.toBeNull();
    expect(db.application.findFirst).not.toHaveBeenCalled();
  });
});
