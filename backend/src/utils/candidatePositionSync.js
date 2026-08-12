const prisma = require('../config/database');
const logger = require('./logger');
const { assertCandidateCanApplyToPosition } = require('./candidateApplicationLock');
const { buildHrbpFptkFilterFromUser } = require('./hrbpScope');

function normalizeTitle(value) {
  return String(value || '').trim();
}

function normalizeFptkIdList(value) {
  if (!value) return [];
  const raw = Array.isArray(value) ? value : [value];
  return [...new Set(raw.map((v) => String(v || '').trim()).filter(Boolean))];
}

function buildScopeFilterForUser(user) {
  if (!user) return null;
  if (user.role === 'HRBP' || user.role === 'TA_SITE') {
    return buildHrbpFptkFilterFromUser(user);
  }
  return null;
}

async function findFptksForTitleTx(tx, title, scopeFilter = null) {
  const normalized = normalizeTitle(title);
  if (!normalized) return [];

  const where = {
    OR: [
      { positionTitle: { equals: normalized, mode: 'insensitive' } },
      { position: { equals: normalized, mode: 'insensitive' } },
    ],
  };
  if (scopeFilter) {
    Object.assign(where, scopeFilter);
  }

  return tx.fPTK.findMany({
    where,
    select: {
      id: true,
      positionTitle: true,
      position: true,
      currentStatus: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function resolveFptkIdsFromPositionsTx(tx, { positionAppliedFor, positionAppliedFptkIds, actorUser }) {
  const ids = new Set(normalizeFptkIdList(positionAppliedFptkIds));
  const scopeFilter = buildScopeFilterForUser(actorUser);
  const titles = Array.isArray(positionAppliedFor)
    ? positionAppliedFor.map(normalizeTitle).filter(Boolean)
    : [];

  for (const title of titles) {
    const matches = await findFptksForTitleTx(tx, title, scopeFilter);
    if (matches.length === 0) {
      logger.warn(`No FPTK found for position title "${title}" during candidate application sync`);
      continue;
    }
    if (matches.length === 1) {
      ids.add(matches[0].id);
      continue;
    }
    const openMatches = matches.filter((row) => {
      const status = String(row.currentStatus || '').toUpperCase();
      return status === 'OPEN' || status === 'RAISE FPTK' || status === '';
    });
    const pick = (openMatches.length > 0 ? openMatches : matches)[0];
    ids.add(pick.id);
    logger.warn(
      `Multiple FPTKs matched title "${title}"; linked candidate to ${pick.id}`
    );
  }

  return [...ids];
}

async function ensureApplicationForFptkTx(tx, candidateId, fptkId, actorUserId) {
  const existing = await tx.application.findFirst({
    where: { candidateId, fptkId },
  });
  if (existing) return existing;

  await assertCandidateCanApplyToPosition(tx, candidateId, fptkId);

  let actorName = null;
  if (actorUserId) {
    const actor = await tx.user.findUnique({
      where: { id: actorUserId },
      select: { firstName: true, lastName: true },
    });
    if (actor) {
      actorName = [actor.firstName, actor.lastName].filter(Boolean).join(' ').trim() || null;
    }
  }

  const application = await tx.application.create({
    data: {
      candidateId,
      fptkId,
      status: 'SUBMITTED',
      currentStage: 1,
      source: 'Manual Entry',
      appliedAt: new Date(),
      appliedByUserId: actorUserId || null,
    },
  });

  await tx.applicationStatusHistory.create({
    data: {
      applicationId: application.id,
      fromStatus: null,
      toStatus: 'SUBMITTED',
      changedBy: actorUserId || null,
      changedByName: actorName,
      reason: 'Application created from candidate position selection',
    },
  });

  return application;
}

async function updateCandidatePositionFptkIdsTx(tx, candidateId, fptkIds) {
  if (!fptkIds.length) return;
  const candidate = await tx.candidate.findUnique({
    where: { id: candidateId },
    select: { languages: true },
  });
  if (!candidate) return;

  let languages = {};
  if (candidate.languages) {
    if (typeof candidate.languages === 'string') {
      try {
        languages = JSON.parse(candidate.languages);
      } catch (_) {
        languages = {};
      }
    } else if (typeof candidate.languages === 'object') {
      languages = { ...candidate.languages };
    }
  }

  const existing = normalizeFptkIdList(languages.positionAppliedFptkIds);
  languages.positionAppliedFptkIds = [...new Set([...existing, ...fptkIds])];

  await tx.candidate.update({
    where: { id: candidateId },
    data: { languages },
  });
}

/**
 * Create Application rows (and positionAppliedFptkIds) so HRBP/TA_SITE list scoping works.
 */
async function syncCandidateApplicationsFromPositions(
  candidateId,
  { positionAppliedFor, positionAppliedFptkIds, actorUserId, actorUser } = {}
) {
  const titles = Array.isArray(positionAppliedFor)
    ? positionAppliedFor.map(normalizeTitle).filter(Boolean)
    : [];
  const explicitIds = normalizeFptkIdList(positionAppliedFptkIds);

  if (titles.length === 0 && explicitIds.length === 0) {
    return { linkedFptkIds: [] };
  }

  return prisma.$transaction(async (tx) => {
    const fptkIds = await resolveFptkIdsFromPositionsTx(tx, {
      positionAppliedFor: titles,
      positionAppliedFptkIds: explicitIds,
      actorUser,
    });

    const linkedFptkIds = [];
    for (const fptkId of fptkIds) {
      try {
        await ensureApplicationForFptkTx(tx, candidateId, fptkId, actorUserId);
        linkedFptkIds.push(fptkId);
      } catch (error) {
        if (error?.code === 'CANDIDATE_LOCKED_FOR_OTHER_POSITION' || error?.statusCode === 409) {
          throw error;
        }
        logger.warn(
          `Skipped application sync for candidate ${candidateId} on FPTK ${fptkId}: ${error.message}`
        );
      }
    }

    if (linkedFptkIds.length > 0) {
      await updateCandidatePositionFptkIdsTx(tx, candidateId, linkedFptkIds);
    }

    return { linkedFptkIds };
  });
}

module.exports = {
  syncCandidateApplicationsFromPositions,
};
