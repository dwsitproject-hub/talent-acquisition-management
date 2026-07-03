const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  saveRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
} = require('../utils/token');
const logger = require('../utils/logger');
const auditService = require('./auditService');

/**
 * Register a new candidate user
 */
async function registerCandidate(data) {
  const { email, password, firstName, lastName, phoneNumber } = data;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error('Email already registered');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Create user and candidate profile in transaction
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phoneNumber,
        role: 'CANDIDATE',
        isActive: true,
      },
    });

    const candidate = await tx.candidate.create({
      data: {
        userId: user.id,
      },
    });

    return { user, candidate };
  });

  logger.info(`New candidate registered: ${email}`);

  return {
    userId: result.user.id,
    email: result.user.email,
    firstName: result.user.firstName,
    lastName: result.user.lastName,
    candidateId: result.candidate.id,
  };
}

/**
 * Login user
 */
async function login(email, password, metadata = {}) {
  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error('Invalid credentials');
  }

  // Check if account is locked
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil((user.lockedUntil - new Date()) / 60000);
    throw new Error(`Account is locked. Try again in ${minutesLeft} minutes`);
  }

  // Check if account is active
  if (!user.isActive) {
    throw new Error('Account is deactivated');
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password || '');

  if (!isValidPassword) {
    // Increment failed login count
    // Be defensive: older/dirty data or partial selects can yield null/undefined.
    // Prisma will reject NaN, so normalize to a number first.
    const currentFailedLoginCount = Number(user.failedLoginCount ?? 0) || 0;
    const failedCount = currentFailedLoginCount + 1;
    const lockoutThreshold = parseInt(process.env.ACCOUNT_LOCKOUT_THRESHOLD) || 5;
    const lockoutDuration = parseInt(process.env.ACCOUNT_LOCKOUT_DURATION) || 900000; // 15 minutes

    const updateData = {
      failedLoginCount: failedCount,
    };

    if (failedCount >= lockoutThreshold) {
      updateData.lockedUntil = new Date(Date.now() + lockoutDuration);
      logger.warn(`Account locked for user: ${email}`);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    throw new Error('Invalid credentials');
  }

  // Reset failed login count and update last login
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  // Generate tokens
  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  const refreshToken = generateRefreshToken({
    userId: user.id,
  });

  // Save refresh token
  await saveRefreshToken(user.id, refreshToken, metadata);

  logger.info(`User logged in: ${email}`);

  await auditService.recordAuthEvent('LOGIN', user.id, metadata);

  // Map backend enum to frontend role name
  const mapEnumToRole = (role) => {
    const roleMap = {
      'SUPER_ADMIN': 'SUPER_ADMIN',
      'CHRO': 'Management',
      'DEPARTMENT_HEAD': 'Head of Division',
      'HRBP': 'HRBP',
      'TA_SITE': 'TA_SITE',
      'TA_HO': 'TA_HO',
      'HIRING_MANAGER': 'HIRING_MANAGER',
      'INTERVIEWER': 'INTERVIEWER',
      'CANDIDATE': 'CANDIDATE',
    };
    return roleMap[role] || role;
  };

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: mapEnumToRole(user.role),
      department: user.department,
      division: user.division,
      pt: user.pt,
      area: user.area,
      areaDetail: user.areaDetail,
    },
  };
}

/**
 * Refresh access token
 */
async function refreshAccessToken(refreshToken) {
  // Verify refresh token
  const decoded = verifyRefreshToken(refreshToken);

  // Check if token exists and not revoked
  const tokenRecord = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
  });

  if (!tokenRecord) {
    throw new Error('Invalid refresh token');
  }

  if (tokenRecord.revokedAt) {
    // Possible token reuse - revoke all user's tokens
    await revokeAllUserTokens(tokenRecord.userId);
    logger.warn(`Possible token reuse detected for user: ${tokenRecord.userId}`);
    throw new Error('Refresh token has been revoked');
  }

  if (tokenRecord.expiresAt < new Date()) {
    throw new Error('Refresh token expired');
  }

  // Get user
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
  });

  if (!user || !user.isActive) {
    throw new Error('User not found or inactive');
  }

  // Generate new tokens
  const newAccessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  const newRefreshToken = generateRefreshToken({
    userId: user.id,
  });

  // Revoke old refresh token and save new one
  await revokeRefreshToken(refreshToken);
  await saveRefreshToken(user.id, newRefreshToken, {
    ipAddress: tokenRecord.ipAddress,
    userAgent: tokenRecord.userAgent,
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

/**
 * Logout user
 */
async function logout(refreshToken, metadata = {}) {
  if (refreshToken) {
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      select: { userId: true },
    });

    await revokeRefreshToken(refreshToken);

    if (tokenRecord?.userId) {
      await auditService.recordAuthEvent('LOGOUT', tokenRecord.userId, metadata);
    }

    logger.info('User logged out');
  }
}

/**
 * Change password
 */
async function changePassword(userId, currentPassword, newPassword) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, user.password || '');
  if (!isValid) {
    throw new Error('Current password is incorrect');
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  // Update password
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  // Revoke all refresh tokens to force re-login
  await revokeAllUserTokens(userId);

  logger.info(`Password changed for user: ${userId}`);
}

/**
 * Update current user's profile (self-service)
 * - Intentionally limited to safe fields only
 */
async function updateCurrentUser(userId, data) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const toNullIfEmpty = (value) => {
    if (value === undefined || value === null) return undefined;
    const trimmed = String(value).trim();
    return trimmed === '' ? null : trimmed;
  };

  const updateData = {};

  if (data.firstName !== undefined) updateData.firstName = String(data.firstName).trim();
  if (data.lastName !== undefined) updateData.lastName = String(data.lastName).trim();
  if (data.phoneNumber !== undefined) updateData.phoneNumber = toNullIfEmpty(data.phoneNumber);

  // Prevent empty required fields
  if (updateData.firstName !== undefined && !updateData.firstName) {
    throw new Error('First name is required');
  }
  if (updateData.lastName !== undefined && !updateData.lastName) {
    throw new Error('Last name is required');
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData,
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

  logger.info(`Profile updated for user: ${userId}`);
  return updated;
}

module.exports = {
  registerCandidate,
  login,
  refreshAccessToken,
  logout,
  changePassword,
  updateCurrentUser,
};

