const prisma = require('../config/database');
const logger = require('../utils/logger');
const { authorize } = require('./auth');

function mapEnumToDisplayMenuRole(enumRole) {
  const roleMap = {
    SUPER_ADMIN: 'SUPER_ADMIN',
    CHRO: 'Management',
    DEPARTMENT_HEAD: 'Head of Division',
    HRBP: 'HRBP',
    TA_TEAM: 'TA_TEAM',
    HIRING_MANAGER: 'HIRING_MANAGER',
    INTERVIEWER: 'INTERVIEWER',
    CANDIDATE: 'CANDIDATE',
  };
  return roleMap[enumRole] || enumRole;
}

/**
 * When Menu Access has createRoles/editRoles configured, enforce them (same strings as the admin UI).
 * If the row is missing or the role list is empty, fall back to static authorize(...fallbackRoles).
 */
function requireMenuPermission(menuPath, kind, fallbackRoles) {
  const field = kind === 'create' ? 'createRoles' : 'editRoles';

  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    try {
      const row = await prisma.menuAccess.findUnique({
        where: { menuPath },
      });

      const configured = row?.[field];
      const useConfigured = Array.isArray(configured) && configured.length > 0;

      if (!useConfigured) {
        return authorize(...fallbackRoles)(req, res, next);
      }

      if (configured.includes('*')) {
        return next();
      }

      const userEnum = req.user.role;
      const displayRole = mapEnumToDisplayMenuRole(userEnum);
      const allowed =
        configured.includes(userEnum) || configured.includes(displayRole);

      if (!allowed) {
        logger.warn(
          `Menu ${kind} denied menuPath=${menuPath} userId=${req.user.id} role=${userEnum} display=${displayRole}`
        );
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function requireMenuCreate(menuPath, fallbackRoles) {
  return requireMenuPermission(menuPath, 'create', fallbackRoles);
}

function requireMenuEdit(menuPath, fallbackRoles) {
  return requireMenuPermission(menuPath, 'edit', fallbackRoles);
}

module.exports = {
  requireMenuCreate,
  requireMenuEdit,
  mapEnumToDisplayMenuRole,
};
