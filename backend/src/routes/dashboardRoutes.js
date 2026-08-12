const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const dashboardService = require('../services/dashboardService');

/**
 * Simple in-process TTL cache for dashboard stats.
 * Key: "<userId>:<serialised filter options>"
 * Prevents redundant DB round-trips when the same user refreshes or
 * toggles filters rapidly. Entries expire after CACHE_TTL_MS.
 */
const CACHE_TTL_MS = 30_000; // 30 seconds
const _statsCache = new Map();

function buildStatsCacheKey(user, options) {
  const userId = user?.id ?? 'anon';
  const opts = JSON.stringify(options);
  return `${userId}:${opts}`;
}

function getCachedStats(key) {
  const entry = _statsCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    _statsCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedStats(key, data) {
  // Evict oldest entries when cache grows beyond 200 entries (memory guard)
  if (_statsCache.size >= 200) {
    const oldest = _statsCache.keys().next().value;
    _statsCache.delete(oldest);
  }
  _statsCache.set(key, { ts: Date.now(), data });
}

/**
 * @route   GET /api/dashboard/stats
 * @desc    Get dashboard statistics
 * @access  Private (TA, HRBP, Admin, CHRO)
 */
router.get(
  '/stats',
  authenticate,
  authorize('TA_HO', 'HRBP', 'TA_SITE', 'SUPER_ADMIN', 'CHRO', 'DEPARTMENT_HEAD', 'HIRING_MANAGER'),
  asyncHandler(async (req, res) => {
    const { priority, positionStatus, area, areaDetails, periodStart, periodEnd, previousStart, previousEnd } =
      req.query;
    const options = {
      priority,
      positionStatus,
      area,
      areaDetails,
      periodStart,
      periodEnd,
      previousStart,
      previousEnd,
    };

    const cacheKey = buildStatsCacheKey(req.user, options);
    const cached = getCachedStats(cacheKey);
    if (cached) {
      res.set('Cache-Control', `private, max-age=${Math.floor(CACHE_TTL_MS / 1000)}`);
      res.set('X-Dashboard-Cache', 'HIT');
      return res.json({ success: true, data: cached });
    }

    const stats = await dashboardService.getDashboardStats(req.user, options);
    setCachedStats(cacheKey, stats);
    res.set('Cache-Control', `private, max-age=${Math.floor(CACHE_TTL_MS / 1000)}`);
    res.set('X-Dashboard-Cache', 'MISS');
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
  authorize('TA_HO', 'HRBP', 'TA_SITE', 'SUPER_ADMIN', 'CHRO', 'DEPARTMENT_HEAD', 'HIRING_MANAGER'),
  asyncHandler(async (req, res) => {
    const { priority, positionStatus, area, areaDetails, periodStart, periodEnd, previousStart, previousEnd } =
      req.query;
    const options = {
      priority,
      positionStatus,
      area,
      areaDetails,
      periodStart,
      periodEnd,
      previousStart,
      previousEnd,
    };

    const cacheKey = buildStatsCacheKey(req.user, options);
    const cached = getCachedStats(cacheKey);
    if (cached) {
      res.set('Cache-Control', `private, max-age=${Math.floor(CACHE_TTL_MS / 1000)}`);
      res.set('X-Dashboard-Cache', 'HIT');
      return res.json({ success: true, data: cached });
    }

    const stats = await dashboardService.getDashboardStats(req.user, options);
    setCachedStats(cacheKey, stats);
    res.set('Cache-Control', `private, max-age=${Math.floor(CACHE_TTL_MS / 1000)}`);
    res.set('X-Dashboard-Cache', 'MISS');
    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * @route   GET /api/dashboard/details
 * @desc    Drill-down list for dashboard cards / location overview (same filters as stats)
 * @access  Private
 */
router.get(
  '/details',
  authenticate,
  authorize('TA_HO', 'HRBP', 'TA_SITE', 'SUPER_ADMIN', 'CHRO', 'DEPARTMENT_HEAD', 'HIRING_MANAGER'),
  asyncHandler(async (req, res) => {
    const {
      priority,
      positionStatus,
      area,
      areaDetails,
      periodStart,
      periodEnd,
      previousStart,
      previousEnd,
      detail,
      areaDetail,
      slaBucket,
      usePeriod,
    } = req.query;
    const result = await dashboardService.getDashboardDetailList(req.user, {
      priority,
      positionStatus,
      area,
      areaDetails,
      periodStart,
      periodEnd,
      previousStart,
      previousEnd,
      detail,
      areaDetail,
      slaBucket,
      usePeriod,
    });
    // Detail lists are user-scoped drill-downs; short private cache is safe
    res.set('Cache-Control', 'private, max-age=30');
    res.json({
      success: true,
      data: result,
    });
  })
);

module.exports = router;

