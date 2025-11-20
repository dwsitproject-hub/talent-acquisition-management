const authService = require('../services/authService');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Register candidate
 * POST /api/auth/register
 */
exports.register = asyncHandler(async (req, res) => {
  const result = await authService.registerCandidate(req.body);

  res.status(201).json({
    success: true,
    message: 'Registration successful',
    data: result,
  });
});

/**
 * Login
 * POST /api/auth/login
 */
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  
  const metadata = {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  };

  const result = await authService.login(email, password, metadata);

  // Set refresh token as httpOnly cookie
  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.COOKIE_SAME_SITE || 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      accessToken: result.accessToken,
      user: result.user,
    },
  });
});

/**
 * Refresh token
 * POST /api/auth/refresh
 */
exports.refresh = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      message: 'Refresh token required',
    });
  }

  const result = await authService.refreshAccessToken(refreshToken);

  // Set new refresh token as httpOnly cookie
  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.COOKIE_SAME_SITE || 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.json({
    success: true,
    message: 'Token refreshed',
    data: {
      accessToken: result.accessToken,
    },
  });
});

/**
 * Logout
 * POST /api/auth/logout
 */
exports.logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

  await authService.logout(refreshToken);

  // Clear refresh token cookie
  res.clearCookie('refreshToken');

  res.json({
    success: true,
    message: 'Logout successful',
  });
});

/**
 * Change password
 * POST /api/auth/change-password
 */
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  await authService.changePassword(userId, currentPassword, newPassword);

  res.json({
    success: true,
    message: 'Password changed successfully',
  });
});

/**
 * Get current user
 * GET /api/auth/me
 */
exports.getCurrentUser = asyncHandler(async (req, res) => {
  // Map backend enum to frontend role name
  const mapEnumToRole = (role) => {
    const roleMap = {
      'SUPER_ADMIN': 'SUPER_ADMIN',
      'CHRO': 'Management',
      'DEPARTMENT_HEAD': 'Head of Division',
      'HRBP': 'HRBP',
      'TA_TEAM': 'TA_TEAM',
      'HIRING_MANAGER': 'HIRING_MANAGER',
      'INTERVIEWER': 'INTERVIEWER',
      'CANDIDATE': 'CANDIDATE',
    };
    return roleMap[role] || role;
  };

  const userData = {
    ...req.user,
    role: mapEnumToRole(req.user.role),
  };

  res.json({
    success: true,
    data: { user: userData },
  });
});

