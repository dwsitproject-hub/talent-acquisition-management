const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const dashboardService = require('../services/dashboardService');

/**
 * @route   GET /api/dashboard/stats
 * @desc    Get dashboard statistics
 * @access  Private (TA, HRBP, Admin, CHRO)
 */
router.get(
  '/stats',
  authenticate,
  authorize('TA_TEAM', 'HRBP', 'SUPER_ADMIN', 'CHRO', 'DEPARTMENT_HEAD', 'HIRING_MANAGER'),
  asyncHandler(async (req, res) => {
    const { priority, positionStatus, area, periodStart, periodEnd, previousStart, previousEnd } = req.query;
    const options = { priority, positionStatus, area, periodStart, periodEnd, previousStart, previousEnd };
    const stats = await dashboardService.getDashboardStats(req.user, options);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * @route   GET /api/dashboard/metrics
 * @desc    Get dashboard metrics (alias for stats)
 * @access  Private (TA, HRBP, Admin, CHRO)
 */
router.get(
  '/metrics',
  authenticate,
  authorize('TA_TEAM', 'HRBP', 'SUPER_ADMIN', 'CHRO', 'DEPARTMENT_HEAD', 'HIRING_MANAGER'),
  asyncHandler(async (req, res) => {
    const { priority, positionStatus, area, periodStart, periodEnd, previousStart, previousEnd } = req.query;
    const options = { priority, positionStatus, area, periodStart, periodEnd, previousStart, previousEnd };
    const stats = await dashboardService.getDashboardStats(req.user, options);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json({
      success: true,
      data: stats,
    });
  })
);

module.exports = router;

