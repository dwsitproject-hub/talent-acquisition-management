const { body, param, query, validationResult } = require('express-validator');

/**
 * Validate request and return errors
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value,
      })),
    });
  }
  
  next();
}

/**
 * Common validation rules
 */
const validationRules = {
  // User registration
  register: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
      .withMessage('Password must contain uppercase, lowercase, number and special character'),
    body('firstName')
      .trim()
      .notEmpty()
      .withMessage('First name is required')
      .isLength({ max: 50 })
      .withMessage('First name too long'),
    body('lastName')
      .trim()
      .notEmpty()
      .withMessage('Last name is required')
      .isLength({ max: 50 })
      .withMessage('Last name too long'),
    body('phoneNumber')
      .optional()
      .matches(/^\+?[1-9]\d{1,14}$/)
      .withMessage('Invalid phone number format'),
  ],

  // Login
  login: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
  ],

  // Create FPTK
  createFPTK: [
    // Accept either fptkNumber or noFktk
    body('fptkNumber')
      .optional()
      .trim(),
    body('noFktk')
      .optional()
      .trim(),
    // Accept either positionTitle or position
    body('positionTitle')
      .optional()
      .trim(),
    body('position')
      .optional()
      .trim(),
    body('department')
      .trim()
      .notEmpty()
      .withMessage('Department is required'),
    // Accept either numberOfPositions or totalRequest
    body('numberOfPositions')
      .optional()
      .custom((value) => {
        if (value === undefined || value === null || value === '') return true;
        const num = typeof value === 'string' ? parseInt(value, 10) : value;
        if (isNaN(num) || num < 1) {
          throw new Error('Number of positions must be at least 1');
        }
        return true;
      }),
    body('totalRequest')
      .optional()
      .custom((value) => {
        if (value === undefined || value === null || value === '') return true;
        const num = typeof value === 'string' ? parseInt(value, 10) : value;
        if (isNaN(num) || num < 1) {
          throw new Error('Number of positions must be at least 1');
        }
        return true;
      }),
    // Accept either jobDescription or jobSpecification
    body('jobDescription')
      .optional()
      .trim(),
    body('jobSpecification')
      .optional()
      .trim(),
    // Custom validator to ensure at least one of each pair is provided
    // Note: FPTK number is optional - the service will generate one if not provided
    body('department').custom((value, { req }) => {
      const statusFktk = req.body.statusFktk?.trim().toLowerCase();
      const fptkNumber = req.body.fptkNumber?.trim() || '';
      const noFktk = req.body.noFktk?.trim() || '';
      const providedNumber = fptkNumber || noFktk;

      if (statusFktk === 'received' && !providedNumber) {
        throw new Error('FPTK number (noFktk) is required when Status FKTK is Received');
      }

      const positionTitle = req.body.positionTitle?.trim() || '';
      const position = req.body.position?.trim() || '';
      if (!positionTitle && !position) {
        throw new Error('Position title (positionTitle or position) is required');
      }
      const numberOfPositions = req.body.numberOfPositions;
      const totalRequest = req.body.totalRequest;
      // Check if totalRequest is a valid number (string or number)
      const totalRequestValue = totalRequest ? (typeof totalRequest === 'string' ? totalRequest.trim() : String(totalRequest)) : '';
      const numberOfPositionsValue = numberOfPositions ? (typeof numberOfPositions === 'string' ? numberOfPositions.trim() : String(numberOfPositions)) : '';
      if (!numberOfPositionsValue && !totalRequestValue) {
        throw new Error('Number of positions (numberOfPositions or totalRequest) is required');
      }
      const jobDescription = req.body.jobDescription?.trim() || '';
      const jobSpecification = req.body.jobSpecification?.trim() || '';
      if (!jobDescription && !jobSpecification) {
        throw new Error('Job description (jobDescription or jobSpecification) is required');
      }
      return true;
    }),
  ],

  // Create application
  createApplication: [
    body('fptkId')
      .isUUID()
      .withMessage('Valid FPTK ID is required'),
    body('source')
      .optional()
      .trim()
      .isIn(['LinkedIn', 'Referral', 'Job Board', 'Direct', 'Agency', 'Other'])
      .withMessage('Invalid application source'),
  ],

  // Schedule interview
  scheduleInterview: [
    body('applicationId')
      .isUUID()
      .withMessage('Valid application ID is required'),
    body('interviewType')
      .isIn(['PHONE_SCREEN', 'HR_INTERVIEW', 'TECHNICAL_INTERVIEW', 'MANAGERIAL_INTERVIEW', 'PANEL_INTERVIEW', 'FINAL_INTERVIEW'])
      .withMessage('Invalid interview type'),
    body('scheduledAt')
      .isISO8601()
      .withMessage('Valid date and time is required'),
    body('duration')
      .isInt({ min: 15, max: 480 })
      .withMessage('Duration must be between 15 and 480 minutes'),
    body('interviewerId')
      .optional()
      .isUUID()
      .withMessage('Valid interviewer ID is required'),
  ],

  // Create offer
  createOffer: [
    body('applicationId')
      .isUUID()
      .withMessage('Valid application ID is required'),
    body('jobTitle')
      .trim()
      .notEmpty()
      .withMessage('Job title is required'),
    body('basicSalary')
      .isFloat({ min: 0 })
      .withMessage('Valid basic salary is required'),
    body('totalPackage')
      .isFloat({ min: 0 })
      .withMessage('Valid total package is required'),
    body('startDate')
      .isISO8601()
      .withMessage('Valid start date is required'),
  ],

  // UUID param validation
  uuidParam: (paramName = 'id') => [
    param(paramName)
      .isUUID()
      .withMessage(`Valid ${paramName} is required`),
  ],

  // Pagination
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Limit must be between 1 and 1000'),
  ],

  // Update candidate profile
  updateCandidateProfile: [
    body('dateOfBirth')
      .optional()
      .isISO8601()
      .withMessage('Valid date of birth is required'),
    body('gender')
      .optional()
      .isIn(['Male', 'Female', 'Other'])
      .withMessage('Invalid gender'),
    body('maritalStatus')
      .optional()
      .isIn(['Single', 'Married', 'Divorced', 'Widowed'])
      .withMessage('Invalid marital status'),
    body('expectedSalary')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Expected salary must be a positive number'),
  ],
};

module.exports = {
  validate,
  validationRules,
};

