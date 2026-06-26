/**
 * Head of Division users store multiple Division / Section values in User.division
 * and User.department (section) as a single string joined by SEP (legacy single values unchanged).
 */

const { parseMulti, packField, inFilter } = require('./hrbpScope');

const SEP = '||';

function isDepartmentHeadRole(role) {
  return role === 'DEPARTMENT_HEAD' || role === 'Head of Division';
}

function parseHodDivisions(user) {
  return parseMulti(user?.division);
}

function parseHodSections(user) {
  return parseMulti(user?.department);
}

/**
 * Prisma where fragment for FPTK rows scoped to a Head of Division user.
 * @returns {object|null}
 */
function buildHodFptkFilterFromUser(user) {
  const divisions = parseHodDivisions(user);
  const sections = parseHodSections(user);
  if (divisions.length === 0) {
    return null;
  }
  const filter = {
    division: inFilter(divisions),
  };
  if (sections.length > 0) {
    filter.section = inFilter(sections);
  }
  return filter;
}

/**
 * Prisma where fragment for candidate.user relation.
 * @returns {object|null}
 */
function buildHodCandidateUserFilterFromUser(user) {
  const divisions = parseHodDivisions(user);
  const sections = parseHodSections(user);
  if (divisions.length === 0) {
    return null;
  }
  const filter = {
    division: inFilter(divisions),
  };
  if (sections.length > 0) {
    filter.department = inFilter(sections);
  }
  return filter;
}

/**
 * Candidate list/detail scope: profile matches OR has application to matching position.
 * @returns {object|null}
 */
function buildHodCandidateScopeFromUser(user) {
  const fptkFilter = buildHodFptkFilterFromUser(user);
  const userFilter = buildHodCandidateUserFilterFromUser(user);
  if (!fptkFilter && !userFilter) {
    return null;
  }
  const orClauses = [];
  if (userFilter) {
    orClauses.push({ user: userFilter });
  }
  if (fptkFilter) {
    orClauses.push({
      applications: {
        some: {
          fptk: fptkFilter,
        },
      },
    });
  }
  if (orClauses.length === 1) {
    return orClauses[0];
  }
  return { OR: orClauses };
}

/**
 * Application list scope for Head of Division.
 * @returns {object|null}
 */
function buildHodApplicationScopeFromUser(user) {
  const fptkFilter = buildHodFptkFilterFromUser(user);
  const userFilter = buildHodCandidateUserFilterFromUser(user);
  if (!fptkFilter && !userFilter) {
    return null;
  }
  const orClauses = [];
  if (fptkFilter) {
    orClauses.push({ fptk: fptkFilter });
  }
  if (userFilter) {
    orClauses.push({ candidate: { user: userFilter } });
  }
  if (orClauses.length === 1) {
    return orClauses[0];
  }
  return { OR: orClauses };
}

function serializeHodFields({ division, sectionName }) {
  return {
    division: packField(division),
    department: packField(sectionName),
  };
}

module.exports = {
  SEP,
  isDepartmentHeadRole,
  parseHodDivisions,
  parseHodSections,
  buildHodFptkFilterFromUser,
  buildHodCandidateUserFilterFromUser,
  buildHodCandidateScopeFromUser,
  buildHodApplicationScopeFromUser,
  serializeHodFields,
};
