const logger = require('../utils/logger');

/**
 * Global error handler middleware
 */
function errorHandler(err, req, res, next) {
  // Check if response was already sent
  if (res.headersSent) {
    return next(err);
  }
  
  // Check for authentication errors FIRST (before logging)
  // Get error message from multiple possible sources - try multiple ways to get the message
  let errorMessage = '';
  let errorStack = '';
  
  if (err) {
    errorMessage = err.message || err.toString() || String(err) || '';
    errorStack = err.stack || '';
  }
  
  // Convert to strings to ensure proper comparison
  const errorMsgStr = String(errorMessage || '').trim();
  const errorStackStr = String(errorStack || '');
  
  // Check for authentication-related errors - check both message and stack
  // Use a simple, direct check - check exact match first
  const isInvalidCredentials = errorMsgStr === 'Invalid credentials' || 
                                errorMsgStr.indexOf('Invalid credentials') !== -1 ||
                                errorStackStr.indexOf('Invalid credentials') !== -1;
  const isAccountLocked = errorMsgStr.indexOf('Account is locked') !== -1 ||
                          errorStackStr.indexOf('Account is locked') !== -1;
  const isAccountDeactivated = errorMsgStr.indexOf('Account is deactivated') !== -1 ||
                               errorStackStr.indexOf('Account is deactivated') !== -1;
  
  const isAuthError = isInvalidCredentials || isAccountLocked || isAccountDeactivated;
  
  // If any auth error is detected, return 401 immediately
  if (isAuthError) {
    // Don't log auth errors as errors - they're expected
    // Return 401 response
    return res.status(401).json({
      success: false,
      message: errorMsgStr || 'Invalid credentials',
    });
  }
  
  // If we get here, it's not an auth error, so continue with normal error handling
  // Log non-auth errors
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    user: req.user?.id,
  });

  // Prisma errors
  if (err.code && err.code.startsWith('P')) {
    return handlePrismaError(err, res);
  }

  // Check for specific error messages that should return 409 (Conflict)
  if (err.message && (err.message.includes('already exists') || err.message.includes('already registered'))) {
    return res.status(409).json({
      success: false,
      message: err.message,
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: err.details || err.message,
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }

  // Multer file upload errors
  if (err.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      message: `File upload error: ${err.message}`,
    });
  }

  // Default error
  const statusCode = err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production' && statusCode >= 500
      ? 'Internal server error'
      : err.message;

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

/**
 * Handle Prisma-specific errors
 */
function handlePrismaError(err, res) {
  switch (err.code) {
    case 'P2002':
      // Unique constraint violation
      const field = err.meta?.target?.[0] || 'field';
      return res.status(409).json({
        success: false,
        message: `${field} already exists`,
      });

    case 'P2025':
      // Record not found
      return res.status(404).json({
        success: false,
        message: 'Record not found',
      });

    case 'P2003':
      // Foreign key constraint violation
      return res.status(400).json({
        success: false,
        message: 'Referenced record does not exist',
      });

    case 'P2014':
      // Invalid relation
      return res.status(400).json({
        success: false,
        message: 'Invalid relation in query',
      });

    default:
      return res.status(500).json({
        success: false,
        message: 'Database error',
      });
  }
}

/**
 * 404 Not Found handler
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.url} not found`,
  });
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
};

