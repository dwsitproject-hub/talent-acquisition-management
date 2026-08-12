const { verifyAccessToken } = require('../utils/token');
const prisma = require('../config/database');
const logger = require('../utils/logger');
const { setAuditUserId } = require('../utils/auditContext');

/**
 * Authentication middleware - verifies JWT token
 */
async function authenticate(req, res, next) {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = verifyAccessToken(token);

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        role: true,
        department: true,
        division: true,
        pt: true,
        area: true,
        areaDetail: true,
        isActive: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated',
      });
    }

    // Attach user to request
    req.user = user;
    setAuditUserId(user.id);
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
}

/**
 * Authorization middleware - checks user role
 * @param {string[]} allowedRoles - Array of allowed roles
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    // Map backend enum to frontend role name for comparison
    const mapEnumToRole = (role) => {
      const roleMap = {
        'SUPER_ADMIN': 'SUPER_ADMIN',
        'CHRO': 'Management',
        'DEPARTMENT_HEAD': 'Head of Division',
        'HRBP': 'HRBP',
        'TA_HO': 'TA_HO',
        'TA_SITE': 'TA_SITE',
        'HIRING_MANAGER': 'HIRING_MANAGER',
        'INTERVIEWER': 'INTERVIEWER',
        'CANDIDATE': 'CANDIDATE',
      };
      return roleMap[role] || role;
    };

    const userRole = req.user.role;
    const mappedUserRole = mapEnumToRole(userRole);
    
    // Also create reverse mapping (frontend role name to backend enum)
    const mapRoleToEnum = (role) => {
      const roleMap = {
        'SUPER_ADMIN': 'SUPER_ADMIN',
        'Management': 'CHRO',
        'Head of Division': 'DEPARTMENT_HEAD',
        'HRBP': 'HRBP',
        'TA_HO': 'TA_HO',
        'TA_SITE': 'TA_SITE',
        'HIRING_MANAGER': 'HIRING_MANAGER',
        'INTERVIEWER': 'INTERVIEWER',
        'CANDIDATE': 'CANDIDATE',
      };
      return roleMap[role] || role;
    };
    
    // Normalize allowedRoles to include both enum and display names
    const normalizedAllowedRoles = new Set(allowedRoles);
    allowedRoles.forEach(role => {
      const enumRole = mapRoleToEnum(role);
      const displayRole = mapEnumToRole(enumRole);
      normalizedAllowedRoles.add(enumRole);
      normalizedAllowedRoles.add(displayRole);
    });
    
    // Check both backend enum and mapped role name
    if (!normalizedAllowedRoles.has(userRole) && !normalizedAllowedRoles.has(mappedUserRole)) {
      logger.warn(`Unauthorized access attempt by user ${req.user.id} with role ${userRole} (mapped: ${mappedUserRole}), allowed: ${Array.from(normalizedAllowedRoles).join(', ')}, original: ${allowedRoles.join(', ')}`);
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
      });
    }

    next();
  };
}

/**
 * Check if user owns the resource (for candidates)
 * @param {string} resourceIdParam - Parameter name containing resource ID
 */
function checkOwnership(resourceIdParam = 'id') {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[resourceIdParam];
      const userId = req.user.id;
      const userRole = req.user.role;

      // Admins and HR can access everything
      if (['SUPER_ADMIN', 'CHRO', 'HRBP', 'TA_HO', 'TA_SITE'].includes(userRole)) {
        return next();
      }

      // For candidates, check if they own the resource
      if (userRole === 'CANDIDATE') {
        const candidate = await prisma.candidate.findFirst({
          where: { userId, isDeleted: false },
          select: { id: true },
        });

        if (candidate && candidate.id === resourceId) {
          return next();
        }

        return res.status(403).json({
          success: false,
          message: 'You can only access your own resources',
        });
      }

      next();
    } catch (error) {
      logger.error('Ownership check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error checking resource ownership',
      });
    }
  };
}

/**
 * Optional authentication - doesn't fail if no token provided
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        department: true,
        division: true,
        pt: true,
        area: true,
        areaDetail: true,
        isActive: true,
      },
    });

    if (user && user.isActive) {
      req.user = user;
      setAuditUserId(user.id);
    }

    next();
  } catch (error) {
    // Silently fail - token is optional
    next();
  }
}

module.exports = {
  authenticate,
  authorize,
  checkOwnership,
  optionalAuth,
};

