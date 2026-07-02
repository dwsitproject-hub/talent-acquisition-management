const express = require('express');
const router = express.Router();
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { requireMenuCreate } = require('../middleware/menuAccessAuth');
const { asyncHandler } = require('../middleware/errorHandler');
const fptkService = require('../services/fptkService');
const { validationRules, validate } = require('../middleware/validator');
const { assertUserCanAccessFptk } = require('../utils/fptkAccess');

/**
 * @route   POST /api/fptk
 * @desc    Create new FPTK
 * @access  Private (Hiring Manager, TA, Admin)
 */
router.post(
  '/',
  authenticate,
  requireMenuCreate('/fptk', ['HIRING_MANAGER', 'TA_HO', 'SUPER_ADMIN']),
  validationRules.createFPTK,
  validate,
  asyncHandler(async (req, res) => {
    // Merge files from express-fileupload into body for service
    const data = { ...req.body, files: req.files };
    
    // Parse JSON fields if they're strings (from FormData)
    if (typeof data.appliedCandidates === 'string') {
      try {
        data.appliedCandidates = JSON.parse(data.appliedCandidates);
      } catch (e) {
        // Keep as is if parsing fails
      }
    }
    // Handle requiredSkills - could be array, string array, or JSON string
    if (typeof data.requiredSkills === 'string') {
      if (data.requiredSkills.startsWith('[')) {
        try {
          data.requiredSkills = JSON.parse(data.requiredSkills);
        } catch (e) {
          // If parsing fails, split by comma
          data.requiredSkills = data.requiredSkills.split(',').map(s => s.trim()).filter(s => s);
        }
      } else {
        // Comma-separated string
        data.requiredSkills = data.requiredSkills.split(',').map(s => s.trim()).filter(s => s);
      }
    }
    // Handle if it's already an array from FormData
    if (Array.isArray(data.requiredSkills)) {
      data.requiredSkills = data.requiredSkills.filter(s => s);
    }
    
    const fptk = await fptkService.createFPTK(data, req.user.id);
    
    res.status(201).json({
      success: true,
      message: 'FPTK created successfully',
      data: fptk,
    });
  })
);

/**
 * @route   GET /api/fptk/published
 * @desc    Get published job positions (for candidate portal)
 * @access  Public (with optional auth)
 */
router.get(
  '/published',
  optionalAuth,
  validationRules.pagination,
  validate,
  asyncHandler(async (req, res) => {
    const filters = {
      department: req.query.department,
      location: req.query.location,
      employmentType: req.query.employmentType,
      search: req.query.search,
    };
    
    const pagination = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
    };
    
    const result = await fptkService.getPublishedFPTKs(filters, pagination);
    
    res.json({
      success: true,
      data: result.jobs,
      pagination: result.pagination,
    });
  })
);

/**
 * @route   GET /api/fptk
 * @desc    Get all FPTKs (internal)
 * @access  Private (TA, HRBP, Admin)
 */
router.get(
  '/',
  authenticate,
  authorize('TA_HO', 'HRBP', 'TA_SITE', 'SUPER_ADMIN', 'HIRING_MANAGER', 'CHRO', 'DEPARTMENT_HEAD'),
  validationRules.pagination,
  validate,
  asyncHandler(async (req, res) => {
    const filters = {
      status: req.query.status,
      department: req.query.department,
      isPublished: req.query.isPublished,
      search: req.query.search,
      currentStatus: req.query.currentStatus,
      pt: req.query.pt,
      area: req.query.area,
      areaDetail: req.query.areaDetail,
    };
    
    const pagination = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
    };
    
    const result = await fptkService.getAllFPTKs(filters, pagination, req.user);
    
    res.json({
      success: true,
      data: result.fptks,
      pagination: result.pagination,
    });
  })
);

/**
 * @route   GET /api/fptk/summary-by-position
 * @desc    Summary by Position (pre-aggregated application counts per FPTK)
 * @access  Private (TA, HRBP, Admin, HM, CHRO, Dept Head)
 */
router.get(
  '/summary-by-position',
  authenticate,
  authorize('TA_HO', 'HRBP', 'TA_SITE', 'SUPER_ADMIN', 'HIRING_MANAGER', 'CHRO', 'DEPARTMENT_HEAD'),
  asyncHandler(async (req, res) => {
    const result = await fptkService.getSummaryByPosition(req.user);
    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * @route   GET /api/fptk/position-options
 * @desc    Lightweight FPTK list for candidate position picker (paginated)
 * @access  Private
 */
router.get(
  '/position-options',
  authenticate,
  authorize('TA_HO', 'HRBP', 'TA_SITE', 'SUPER_ADMIN', 'HIRING_MANAGER', 'CHRO', 'DEPARTMENT_HEAD'),
  validationRules.pagination,
  validate,
  asyncHandler(async (req, res) => {
    const filters = {
      search: req.query.search,
      department: req.query.department,
      pt: req.query.pt,
      area: req.query.area,
      areaDetail: req.query.areaDetail,
    };

    const pagination = {
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 100,
    };

    const result = await fptkService.getFptkPositionOptions(filters, pagination, req.user);

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  })
);

/**
 * @route   GET /api/fptk/counts-by-current-status
 * @desc    Row counts per Current Status (scoped like list; optional search only)
 * @access  Private
 */
router.get(
  '/counts-by-current-status',
  authenticate,
  authorize('TA_HO', 'HRBP', 'TA_SITE', 'SUPER_ADMIN', 'HIRING_MANAGER', 'CHRO', 'DEPARTMENT_HEAD'),
  asyncHandler(async (req, res) => {
    const filters = {
      search: req.query.search,
      pt: req.query.pt,
      area: req.query.area,
      areaDetail: req.query.areaDetail,
    };
    const data = await fptkService.getFptkCurrentStatusCounts(filters, req.user);
    res.json({
      success: true,
      data,
    });
  })
);

/**
 * @route   POST /api/fptk/bulk-delete
 * @desc    Permanently delete multiple FPTKs (and related applications)
 * @access  Private (Super Admin only)
 */
router.post(
  '/bulk-delete',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const result = await fptkService.deleteFPTKsBulk(ids);

    res.json({
      success: true,
      message: `${result.deletedCount} position(s) deleted successfully`,
      data: result,
    });
  })
);

/**
 * @route   GET /api/fptk/:id
 * @desc    Get FPTK by ID
 * @access  Private / Public (based on published status)
 */
router.get(
  '/:id',
  optionalAuth,
  validationRules.uuidParam('id'),
  validate,
  asyncHandler(async (req, res) => {
    const fptk = await fptkService.getFPTKById(req.params.id);
    
    // If not published, require authentication
    if (!fptk.isPublished && !req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (req.user) {
      await assertUserCanAccessFptk(req.user, req.params.id);
    }
    
    res.json({
      success: true,
      data: fptk,
    });
  })
);

/**
 * @route   PUT /api/fptk/:id
 * @desc    Update FPTK
 * @access  Private (Hiring Manager, TA, Admin)
 */
router.put(
  '/:id',
  authenticate,
  authorize('HIRING_MANAGER', 'TA_HO', 'SUPER_ADMIN'),
  validationRules.uuidParam('id'),
  validate,
  asyncHandler(async (req, res) => {
    // Merge files from express-fileupload into body for service
    const data = { ...req.body, files: req.files };
    
    // Parse JSON fields if they're strings (from FormData)
    if (typeof data.appliedCandidates === 'string') {
      try {
        data.appliedCandidates = JSON.parse(data.appliedCandidates);
      } catch (e) {
        // Keep as is if parsing fails
      }
    }
    // Handle requiredSkills - could be array, string array, or JSON string
    if (typeof data.requiredSkills === 'string') {
      if (data.requiredSkills.startsWith('[')) {
        try {
          data.requiredSkills = JSON.parse(data.requiredSkills);
        } catch (e) {
          // If parsing fails, split by comma
          data.requiredSkills = data.requiredSkills.split(',').map(s => s.trim()).filter(s => s);
        }
      } else {
        // Comma-separated string
        data.requiredSkills = data.requiredSkills.split(',').map(s => s.trim()).filter(s => s);
      }
    }
    // Handle if it's already an array from FormData
    if (Array.isArray(data.requiredSkills)) {
      data.requiredSkills = data.requiredSkills.filter(s => s);
    }
    
    const fptk = await fptkService.updateFPTK(req.params.id, data, req.user.id);
    
    res.json({
      success: true,
      message: 'FPTK updated successfully',
      data: fptk,
    });
  })
);

/**
 * @route   DELETE /api/fptk/:id
 * @desc    Permanently delete FPTK (and related applications)
 * @access  Private (Super Admin only)
 */
router.delete(
  '/:id',
  authenticate,
  authorize('SUPER_ADMIN'),
  validationRules.uuidParam('id'),
  validate,
  asyncHandler(async (req, res) => {
    const result = await fptkService.deleteFPTK(req.params.id);

    res.json({
      success: true,
      message: 'Position deleted successfully',
      data: result,
    });
  })
);

/**
 * @route   POST /api/fptk/:id/publish
 * @desc    Publish FPTK
 * @access  Private (TA, Admin)
 */
router.post(
  '/:id/publish',
  authenticate,
  authorize('TA_HO', 'SUPER_ADMIN'),
  validationRules.uuidParam('id'),
  validate,
  asyncHandler(async (req, res) => {
    const fptk = await fptkService.publishFPTK(req.params.id);
    
    res.json({
      success: true,
      message: 'FPTK published successfully',
      data: fptk,
    });
  })
);

/**
 * @route   POST /api/fptk/:id/unpublish
 * @desc    Unpublish FPTK
 * @access  Private (TA, Admin)
 */
router.post(
  '/:id/unpublish',
  authenticate,
  authorize('TA_HO', 'SUPER_ADMIN'),
  validationRules.uuidParam('id'),
  validate,
  asyncHandler(async (req, res) => {
    const fptk = await fptkService.unpublishFPTK(req.params.id);
    
    res.json({
      success: true,
      message: 'FPTK unpublished successfully',
      data: fptk,
    });
  })
);

module.exports = router;

