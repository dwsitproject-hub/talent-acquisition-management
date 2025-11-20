const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
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

module.exports = router;

