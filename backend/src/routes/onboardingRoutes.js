const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// Placeholder for onboarding routes - will be expanded
router.get('/', authenticate, asyncHandler(async (req, res) => {
  res.json({ success: true, message: 'Onboarding routes coming soon' });
}));

module.exports = router;

