const rateLimit = require('express-rate-limit');
// const RedisStore = require('rate-limit-redis');
// const redis = require('../config/redis');

/**
 * General API rate limiter (temporarily using memory store)
 */
const generalLimiter = rateLimit({
  // store: new RedisStore({
  //   client: redis,
  //   prefix: 'rl:general:',
  // }),
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // When mounted on /api, req.path will look like "/auth/login", "/health", etc.
    // Keep auth endpoints controlled by their own limiters (e.g., loginLimiter) instead of generalLimiter.
    if (req.path === '/health') return true;
    if (req.path.startsWith('/auth/')) return true;
    return false;
  },
});

/**
 * Login endpoint rate limiter (stricter)
 */
const loginLimiter = rateLimit({
  // store: new RedisStore({
  //   client: redis,
  //   prefix: 'rl:login:',
  // }),
  windowMs: parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_LOGIN_MAX) || 20, // Increased from 5 to 20
  skipSuccessfulRequests: true, // Don't count successful logins
  message: {
    success: false,
    message: 'Too many login attempts, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * File upload rate limiter
 * Increased limit to allow multiple file uploads (e.g., 5 additional files + CV)
 */
const uploadLimiter = rateLimit({
  // store: new RedisStore({
  //   client: redis,
  //   prefix: 'rl:upload:',
  // }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.UPLOAD_RATE_LIMIT_MAX) || 50, // 50 uploads per hour (allows multiple files per candidate)
  message: {
    success: false,
    message: 'Too many file uploads, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * AI endpoints rate limiter (more restrictive)
 */
const aiLimiter = rateLimit({
  // store: new RedisStore({
  //   client: redis,
  //   prefix: 'rl:ai:',
  // }),
  windowMs: parseInt(process.env.AI_RATE_LIMIT_WINDOW) || 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.AI_RATE_LIMIT_MAX) || 10,
  message: {
    success: false,
    message: 'AI service rate limit exceeded, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Password reset rate limiter
 */
const passwordResetLimiter = rateLimit({
  // store: new RedisStore({
  //   client: redis,
  //   prefix: 'rl:password-reset:',
  // }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: {
    success: false,
    message: 'Too many password reset attempts, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Registration rate limiter
 */
const registrationLimiter = rateLimit({
  // store: new RedisStore({
  //   client: redis,
  //   prefix: 'rl:register:',
  // }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 registrations per hour per IP
  message: {
    success: false,
    message: 'Too many registration attempts, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  generalLimiter,
  loginLimiter,
  uploadLimiter,
  aiLimiter,
  passwordResetLimiter,
  registrationLimiter,
};

