/** Prisma filter: candidate row is active (not soft-deleted). */
const ACTIVE_CANDIDATE_WHERE = { isDeleted: false };

/**
 * Merge an existing candidate where clause with the active (non-deleted) filter.
 */
function withActiveCandidate(where = {}) {
  if (!where || Object.keys(where).length === 0) {
    return { ...ACTIVE_CANDIDATE_WHERE };
  }
  return { AND: [ACTIVE_CANDIDATE_WHERE, where] };
}

/**
 * Merge application list filters to exclude applications for soft-deleted candidates.
 */
function withActiveCandidateOnApplication(where = {}) {
  const activeCandidate = { candidate: ACTIVE_CANDIDATE_WHERE };
  if (!where || Object.keys(where).length === 0) {
    return activeCandidate;
  }
  return { AND: [activeCandidate, where] };
}

function assertActiveCandidate(candidate) {
  if (!candidate || candidate.isDeleted) {
    const error = new Error('Candidate not found');
    error.statusCode = 404;
    throw error;
  }
}

module.exports = {
  ACTIVE_CANDIDATE_WHERE,
  withActiveCandidate,
  withActiveCandidateOnApplication,
  assertActiveCandidate,
};
