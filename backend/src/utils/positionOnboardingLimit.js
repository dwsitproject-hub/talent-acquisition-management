/** A position (FPTK) may have at most this many applications in ONBOARDING at once. */
const MAX_ONBOARDING_PER_POSITION = 1;

const ONBOARDING_APPLICATION_SELECT = {
  id: true,
  candidateId: true,
  fptkId: true,
  candidate: {
    select: {
      user: { select: { firstName: true, lastName: true } },
    },
  },
  fptk: {
    select: { positionTitle: true, position: true },
  },
};

function candidateNameFromApplication(app) {
  const user = app?.candidate?.user;
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return name || null;
}

function positionTitleFromApplication(app) {
  const title = (app?.fptk?.positionTitle || app?.fptk?.position || '').toString().trim();
  return title || null;
}

/** True when the status change moves an application into ONBOARDING. */
function isEnteringOnboarding(oldStatus, newStatus) {
  return newStatus === 'ONBOARDING' && oldStatus !== 'ONBOARDING';
}

function buildPositionOnboardingLimitError(existingOnboarding) {
  const positionTitle = positionTitleFromApplication(existingOnboarding) || 'this position';
  const candidateName = candidateNameFromApplication(existingOnboarding);
  const who = candidateName ? `"${candidateName}"` : 'another candidate';
  const err = new Error(
    `Position "${positionTitle}" already has ${who} On Boarding. Only one candidate can be On Boarding per position. Withdraw that candidate before moving another candidate to On Boarding.`
  );
  err.statusCode = 409;
  err.code = 'POSITION_ONBOARDING_LIMIT_REACHED';
  err.details = {
    fptkId: existingOnboarding?.fptkId ?? null,
    positionTitle,
    onboardingApplicationId: existingOnboarding?.id ?? null,
    onboardingCandidateId: existingOnboarding?.candidateId ?? null,
    onboardingCandidateName: candidateName,
  };
  return err;
}

/**
 * Row-lock the FPTK for the rest of the transaction so two concurrent requests
 * cannot both move a candidate into ONBOARDING on the same position.
 */
async function lockPositionForOnboardingTx(tx, fptkId) {
  if (!fptkId) return;
  await tx.$queryRaw`SELECT id FROM fptk WHERE id = ${fptkId} FOR UPDATE`;
}

/**
 * Throws 409 when the position already has an ONBOARDING application other than
 * excludeApplicationId. Call inside a transaction after lockPositionForOnboardingTx.
 */
async function assertPositionCanAcceptOnboarding(db, fptkId, excludeApplicationId = null) {
  if (!fptkId) return;
  const where = { fptkId, status: 'ONBOARDING' };
  if (excludeApplicationId) {
    where.id = { not: excludeApplicationId };
  }
  const existing = await db.application.findFirst({
    where,
    select: ONBOARDING_APPLICATION_SELECT,
    orderBy: { updatedAt: 'asc' },
  });
  if (existing) {
    throw buildPositionOnboardingLimitError(existing);
  }
}

/**
 * Post-write check for bulk syncs: when the batch moved a candidate into ONBOARDING
 * and the position now exceeds the limit, throw so the transaction rolls back.
 * Positions that already had duplicates (legacy data) stay saveable as long as
 * nobody new enters ONBOARDING.
 */
async function assertPositionOnboardingLimitAfterSyncTx(tx, fptkId, enteredApplicationIds) {
  if (!fptkId || !enteredApplicationIds || enteredApplicationIds.length === 0) return;
  const onboarding = await tx.application.findMany({
    where: { fptkId, status: 'ONBOARDING' },
    select: ONBOARDING_APPLICATION_SELECT,
    orderBy: { updatedAt: 'asc' },
  });
  if (onboarding.length <= MAX_ONBOARDING_PER_POSITION) return;

  const entered = new Set(enteredApplicationIds);
  const incumbent = onboarding.find((app) => !entered.has(app.id)) || onboarding[0];
  throw buildPositionOnboardingLimitError(incumbent);
}

module.exports = {
  MAX_ONBOARDING_PER_POSITION,
  isEnteringOnboarding,
  buildPositionOnboardingLimitError,
  lockPositionForOnboardingTx,
  assertPositionCanAcceptOnboarding,
  assertPositionOnboardingLimitAfterSyncTx,
};
