const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const oidcController = require('../controllers/oidcController');
const { authenticate } = require('../middleware/auth');
const { validate, validationRules } = require('../middleware/validator');
const { loginLimiter, registrationLimiter, passwordResetLimiter } = require('../middleware/rateLimiter');

/**
 * @route   POST /api/auth/register
 * @desc    Register new candidate
 * @access  Public
 */
router.post(
  '/register',
  registrationLimiter,
  validationRules.register,
  validate,
  authController.register
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  loginLimiter,
  validationRules.login,
  validate,
  authController.login
);

/**
 * @route   GET /api/auth/oidc/login
 * @desc    Start DWS Hub OIDC login (SP-initiated)
 * @access  Public
 */
router.get('/oidc/login', oidcController.login);

/**
 * @route   GET /api/auth/oidc/callback
 * @desc    OIDC callback (SP-initiated and IdP-initiated)
 * @access  Public
 */
router.get('/oidc/callback', oidcController.callback);

/**
 * @route   POST /api/auth/oidc/complete
 * @desc    Exchange SSO handoff token for app JWTs
 * @access  Public
 */
router.post('/oidc/complete', loginLimiter, oidcController.complete);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh', authController.refresh);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change password
 * @access  Private
 */
router.post(
  '/change-password',
  authenticate,
  passwordResetLimiter,
  authController.changePassword
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', authenticate, authController.getCurrentUser);

/**
 * @route   PUT /api/auth/me
 * @desc    Update current user profile
 * @access  Private
 */
router.put('/me', authenticate, authController.updateCurrentUser);

module.exports = router;

