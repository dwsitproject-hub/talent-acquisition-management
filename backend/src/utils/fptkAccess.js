const prisma = require('../config/database');
const { buildHrbpFptkFilterFromUser } = require('./hrbpScope');
const { isDepartmentHeadRole, buildHodFptkFilterFromUser } = require('./hodScope');

function forbidden(message) {
  const err = new Error(message || 'Insufficient permissions');
  err.statusCode = 403;
  return err;
}

function buildHiringManagerWhereFromUser(user = null) {
  if (!user) return null;

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
 * Ensures the user may access the given FPTK (scoped roles only).
 * Unrestricted roles pass through. Call only when user is authenticated.
 */
async function assertUserCanAccessFptk(user, fptkId) {
  if (!user) {
    throw forbidden('Unauthorized');
  }

  const userRole = user.role;

  if (['SUPER_ADMIN', 'TA_HO', 'CHRO'].includes(userRole)) {
    return;
  }

  const where = { id: fptkId };

  if (userRole === 'HIRING_MANAGER') {
    const hmWhere = buildHiringManagerWhereFromUser(user);
    if (!hmWhere) {
      throw forbidden('Missing hiring manager identity for position access');
    }
    Object.assign(where, hmWhere);
  } else if (isDepartmentHeadRole(userRole)) {
    const hod = buildHodFptkFilterFromUser(user);
    if (!hod) {
      throw forbidden('Missing division scope for position access');
    }
    Object.assign(where, hod);
  } else if (userRole === 'HRBP' || userRole === 'TA_SITE') {
    const hrbp = buildHrbpFptkFilterFromUser(user);
    if (!hrbp) {
      throw forbidden('Missing PT/Area scope for position access');
    }
    Object.assign(where, hrbp);
  } else {
    throw forbidden('Insufficient permissions');
  }

  const allowed = await prisma.fPTK.findFirst({
    where,
    select: { id: true },
  });

  if (!allowed) {
    throw forbidden('You can only access positions within your assigned scope');
  }
}

module.exports = {
  assertUserCanAccessFptk,
  buildHiringManagerWhereFromUser,
};
