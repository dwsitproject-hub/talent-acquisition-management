/** Application statuses that block new applications on other positions. */
const BLOCK_NEW_APPLICATION_STATUSES = ['ONBOARDING', 'HIRED'];

const BLOCKING_APPLICATION_SELECT = {
  id: true,
  candidateId: true,
  fptkId: true,
  status: true,
  fptk: {
    select: {
      positionTitle: true,
      position: true,
    },
  },
};

function positionTitleFromFptk(fptk) {
  const title = (fptk?.positionTitle || fptk?.position || '').toString().trim();
  return title || null;
}

function buildBlockingWhere(candidateId, excludeFptkId = null) {
  const where = {
    candidateId,
    status: { in: BLOCK_NEW_APPLICATION_STATUSES },
  };
  if (excludeFptkId) {
    where.fptkId = { not: excludeFptkId };
  }
  return where;
}

function buildBlockingWhereForMany(candidateIds, excludeFptkId = null) {
  const where = {
    candidateId: { in: candidateIds },
    status: { in: BLOCK_NEW_APPLICATION_STATUSES },
  };
  if (excludeFptkId) {
    where.fptkId = { not: excludeFptkId };
  }
  return where;
}

/**
 * Find a blocking application for one candidate (relative to optional target FPTK).
 */
async function findBlockingApplication(db, candidateId, excludeFptkId = null) {
  if (!candidateId) return null;
  return db.application.findFirst({
    where: buildBlockingWhere(candidateId, excludeFptkId),
    select: BLOCKING_APPLICATION_SELECT,
    orderBy: { updatedAt: 'desc' },
  });
}

/**
 * Batch-load blocking applications keyed by candidateId (first match per candidate).
 */
async function loadBlockingApplicationsMap(db, candidateIds, excludeFptkId = null) {
  const ids = Array.from(new Set((candidateIds || []).filter(Boolean)));
  if (ids.length === 0) return new Map();

  const rows = await db.application.findMany({
    where: buildBlockingWhereForMany(ids, excludeFptkId),
    select: BLOCKING_APPLICATION_SELECT,
    orderBy: { updatedAt: 'desc' },
  });

  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.candidateId)) {
      map.set(row.candidateId, row);
    }
  }
  return map;
}

function lockFieldsFromBlocking(blocking) {
  if (!blocking) {
    return {
      isLockedForOtherPositions: false,
      lockReason: null,
      lockedApplicationFptkId: null,
      lockedPositionTitle: null,
    };
  }

  const lockedPositionTitle = positionTitleFromFptk(blocking.fptk);
  return {
    isLockedForOtherPositions: true,
    lockReason: blocking.status,
    lockedApplicationFptkId: blocking.fptkId,
    lockedPositionTitle,
  };
}

function buildCandidateLockError(blocking) {
  const lockedPositionTitle = positionTitleFromFptk(blocking?.fptk) || 'another position';
  const statusLabel = blocking?.status === 'HIRED' ? 'hired' : 'onboarding';
  const err = new Error(
    `Candidate is ${statusLabel} on "${lockedPositionTitle}" and cannot be applied to another position. Mark that application as Withdrawn before re-applying elsewhere.`
  );
  err.statusCode = 409;
  err.code = 'CANDIDATE_LOCKED_FOR_OTHER_POSITION';
  err.details = {
    lockedFptkId: blocking?.fptkId ?? null,
    lockedPositionTitle,
    lockReason: blocking?.status ?? null,
  };
  return err;
}

/**
 * Throws when candidate cannot be applied to targetFptkId due to onboarding/hired elsewhere.
 */
async function assertCandidateCanApplyToPosition(db, candidateId, targetFptkId) {
  const blocking = await findBlockingApplication(db, candidateId, targetFptkId);
  if (blocking) {
    throw buildCandidateLockError(blocking);
  }
}

function attachApplicationLockFields(candidate, blockingMap) {
  if (!candidate || !candidate.id) return candidate;
  const blocking = blockingMap.get(candidate.id) || null;
  return {
    ...candidate,
    ...lockFieldsFromBlocking(blocking),
  };
}

async function enrichCandidatesWithApplicationLock(candidates, excludeFptkId = null, db = null) {
  const prismaClient = db;
  if (!prismaClient || !Array.isArray(candidates) || candidates.length === 0) {
    return candidates || [];
  }

  const blockingMap = await loadBlockingApplicationsMap(
    prismaClient,
    candidates.map((c) => c.id),
    excludeFptkId
  );

  return candidates.map((candidate) => attachApplicationLockFields(candidate, blockingMap));
}

async function enrichCandidateWithApplicationLock(candidate, excludeFptkId = null, db = null) {
  if (!candidate?.id || !db) return candidate;
  const blocking = await findBlockingApplication(db, candidate.id, excludeFptkId);
  return {
    ...candidate,
    ...lockFieldsFromBlocking(blocking),
  };
}

module.exports = {
  BLOCK_NEW_APPLICATION_STATUSES,
  assertCandidateCanApplyToPosition,
  attachApplicationLockFields,
  buildCandidateLockError,
  enrichCandidateWithApplicationLock,
  enrichCandidatesWithApplicationLock,
  findBlockingApplication,
  loadBlockingApplicationsMap,
  lockFieldsFromBlocking,
};
