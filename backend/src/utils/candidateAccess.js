const prisma = require('../config/database');
const { buildHrbpApplicationFptkFilterFromUser } = require('./hrbpScope');
const { isDepartmentHeadRole, buildHodCandidateScopeFromUser } = require('./hodScope');

function forbidden(message) {
  const err = new Error(message || 'Insufficient permissions');
  err.statusCode = 403;
  return err;
}

function buildHiringManagerFptkScope(user = {}) {
  const firstName = String(user.firstName || '').trim();
  const lastName = String(user.lastName || '').trim();
  const email = String(user.email || '').trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const values = Array.from(new Set([firstName, fullName, email].filter(Boolean)));
  if (values.length === 0) return null;
  return {
    OR: values.map((value) => ({
      hiringManager: { equals: value, mode: 'insensitive' },
    })),
  };
}

/**
 * Ensures the user may access/modify the given candidate (scoped roles only).
 * Unrestricted roles (SUPER_ADMIN, TA_HO, CHRO) pass through.
 */
async function assertUserCanAccessCandidate(user, candidateId) {
  if (!user) {
    throw forbidden('Unauthorized');
  }

  const userRole = user.role;

  if (['SUPER_ADMIN', 'TA_HO', 'CHRO'].includes(userRole)) {
    return;
  }

  const baseWhere = {
    id: candidateId,
    isDeleted: false,
  };

  if (isDepartmentHeadRole(userRole)) {
    const hodScope = buildHodCandidateScopeFromUser(user);
    const allowed = await prisma.candidate.findFirst({
      where: {
        ...baseWhere,
        ...(hodScope || { id: '00000000-0000-0000-0000-000000000000' }),
      },
      select: { id: true },
    });
    if (!allowed) {
      throw forbidden('You can only access candidates in your assigned division and section');
    }
    return;
  }

  if (userRole === 'HRBP' || userRole === 'TA_SITE') {
    const hrbpScope = buildHrbpApplicationFptkFilterFromUser(user);
    const allowed = await prisma.candidate.findFirst({
      where: {
        ...baseWhere,
        applications: {
          some: hrbpScope || { fptk: { id: '00000000-0000-0000-0000-000000000000' } },
        },
      },
      select: { id: true },
    });
    if (!allowed) {
      throw forbidden('You can only access candidates linked to your assigned PT and area');
    }
    return;
  }

  if (userRole === 'HIRING_MANAGER') {
    const hmScope = buildHiringManagerFptkScope(user);
    if (!hmScope) {
      throw forbidden('Missing hiring manager identity for candidate access');
    }
    const allowed = await prisma.candidate.findFirst({
      where: {
        ...baseWhere,
        applications: {
          some: {
            fptk: hmScope,
          },
        },
      },
      select: { id: true },
    });
    if (!allowed) {
      throw forbidden('You can only access candidates linked to your positions');
    }
    return;
  }
}

module.exports = {
  assertUserCanAccessCandidate,
  buildHiringManagerFptkScope,
};
