export type CandidateApplicationLockFields = {
  isLockedForOtherPositions?: boolean
  lockReason?: string | null
  lockedApplicationFptkId?: string | null
  lockedPositionTitle?: string | null
}

export function isCandidateLockedForOtherPositions(
  candidate: CandidateApplicationLockFields | null | undefined
): boolean {
  return Boolean(candidate?.isLockedForOtherPositions)
}

export function getCandidateLockMessage(candidate: CandidateApplicationLockFields): string {
  const title = candidate.lockedPositionTitle || 'another position'
  const reason = candidate.lockReason === 'HIRED' ? 'hired' : 'onboarding'
  return `This candidate is ${reason} on "${title}" and cannot be added to another position. Mark that application as Withdrawn on the original position before re-applying elsewhere.`
}

export function candidateEligibleForPositionSuggestion(
  candidate: CandidateApplicationLockFields | null | undefined
): boolean {
  return !isCandidateLockedForOtherPositions(candidate)
}

/** Preserve lock fields when mapping API candidate rows. */
export function extractCandidateLockFields(candidate: any): CandidateApplicationLockFields {
  return {
    isLockedForOtherPositions: Boolean(candidate?.isLockedForOtherPositions),
    lockReason: candidate?.lockReason ?? null,
    lockedApplicationFptkId: candidate?.lockedApplicationFptkId ?? null,
    lockedPositionTitle: candidate?.lockedPositionTitle ?? null,
  }
}
