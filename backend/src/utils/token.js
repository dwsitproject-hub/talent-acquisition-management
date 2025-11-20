const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * Generate JWT access token
 * @param {Object} payload - Token payload {userId, role, email}
 * @returns {string} - JWT token
 */
function generateAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Generate JWT refresh token
 * @param {Object} payload - Token payload {userId}
 * @returns {string} - JWT refresh token
 */
function generateRefreshToken(payload) {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
}

/**
 * Verify JWT access token
 * @param {string} token - JWT token
 * @returns {Object} - Decoded token payload
 */
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Verify JWT refresh token
 * @param {string} token - JWT refresh token
 * @returns {Object} - Decoded token payload
 */
function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
}

/**
 * Save refresh token to database
 * @param {string} userId - User ID
 * @param {string} token - Refresh token
 * @param {Object} metadata - Request metadata (IP, user agent)
 * @returns {Object} - Created refresh token record
 */
async function saveRefreshToken(userId, token, metadata = {}) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  return await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    },
  });
}

/**
 * Revoke refresh token
 * @param {string} token - Refresh token to revoke
 */
async function revokeRefreshToken(token) {
  await prisma.refreshToken.update({
    where: { token },
    data: { revokedAt: new Date() },
  });
}

/**
 * Revoke all user's refresh tokens
 * @param {string} userId - User ID
 */
async function revokeAllUserTokens(userId) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Clean up expired tokens
 */
async function cleanupExpiredTokens() {
  const now = new Date();
  await prisma.refreshToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: now } },
        { revokedAt: { not: null } },
      ],
    },
  });
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  saveRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  cleanupExpiredTokens,
};

