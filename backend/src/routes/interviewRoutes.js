const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { validationRules, validate } = require('../middleware/validator');

// Placeholder for interview routes - will be expanded
router.get('/', authenticate, asyncHandler(async (req, res) => {
  res.json({ success: true, message: 'Interview routes coming soon' });
}));

module.exports = router;

