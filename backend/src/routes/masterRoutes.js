const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const masterDivisionService = require('../services/masterDivisionService');
const masterOfficeLocationService = require('../services/masterOfficeLocationService');
const { validationRules, validate } = require('../middleware/validator');

// ==================== MASTER DIVISION ROUTES ====================

/**
 * @route   GET /api/masters/divisions
 * @desc    Get all divisions
 * @access  Private (TA, HRBP, Admin)
 */
router.get(
  '/divisions',
  authenticate,
  authorize('TA_TEAM', 'HRBP', 'SUPER_ADMIN', 'HIRING_MANAGER'),
  asyncHandler(async (req, res) => {
    const filters = {
      search: req.query.search,
      divisionName: req.query.divisionName,
    };

    const divisions = await masterDivisionService.getAllDivisions(filters);

    res.json({
      success: true,
      data: divisions,
    });
  })
);

/**
 * @route   GET /api/masters/divisions/:id
 * @desc    Get division by ID
 * @access  Private (TA, HRBP, Admin)
 */
router.get(
  '/divisions/:id',
  authenticate,
  authorize('TA_TEAM', 'HRBP', 'SUPER_ADMIN'),
  validationRules.uuidParam('id'),
  validate,
  asyncHandler(async (req, res) => {
    const division = await masterDivisionService.getDivisionById(req.params.id);

    res.json({
      success: true,
      data: division,
    });
  })
);

/**
 * @route   POST /api/masters/divisions
 * @desc    Create division
 * @access  Private (TA, Admin)
 */
router.post(
  '/divisions',
  authenticate,
  authorize('TA_TEAM', 'SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const division = await masterDivisionService.createDivision(req.body);

    res.status(201).json({
      success: true,
      message: 'Division created successfully',
      data: division,
    });
  })
);

/**
 * @route   PUT /api/masters/divisions/:id
 * @desc    Update division
 * @access  Private (TA, Admin)
 */
router.put(
  '/divisions/:id',
  authenticate,
  authorize('TA_TEAM', 'SUPER_ADMIN'),
  validationRules.uuidParam('id'),
  validate,
  asyncHandler(async (req, res) => {
    const division = await masterDivisionService.updateDivision(req.params.id, req.body);

    res.json({
      success: true,
      message: 'Division updated successfully',
      data: division,
    });
  })
);

/**
 * @route   DELETE /api/masters/divisions/:id
 * @desc    Delete division
 * @access  Private (TA, Admin)
 */
router.delete(
  '/divisions/:id',
  authenticate,
  authorize('TA_TEAM', 'SUPER_ADMIN'),
  validationRules.uuidParam('id'),
  validate,
  asyncHandler(async (req, res) => {
    await masterDivisionService.deleteDivision(req.params.id);

    res.json({
      success: true,
      message: 'Division deleted successfully',
    });
  })
);

// ==================== MASTER OFFICE LOCATION ROUTES ====================

/**
 * @route   GET /api/masters/office-locations
 * @desc    Get all office locations
 * @access  Private (TA, HRBP, Admin)
 */
router.get(
  '/office-locations',
  authenticate,
  authorize('TA_TEAM', 'HRBP', 'SUPER_ADMIN', 'HIRING_MANAGER'),
  asyncHandler(async (req, res) => {
    const filters = {
      search: req.query.search,
      pt: req.query.pt,
      area: req.query.area,
    };

    const officeLocations = await masterOfficeLocationService.getAllOfficeLocations(filters);

    res.json({
      success: true,
      data: officeLocations,
    });
  })
);

/**
 * @route   GET /api/masters/office-locations/:id
 * @desc    Get office location by ID
 * @access  Private (TA, HRBP, Admin)
 */
router.get(
  '/office-locations/:id',
  authenticate,
  authorize('TA_TEAM', 'HRBP', 'SUPER_ADMIN'),
  validationRules.uuidParam('id'),
  validate,
  asyncHandler(async (req, res) => {
    const officeLocation = await masterOfficeLocationService.getOfficeLocationById(req.params.id);

    res.json({
      success: true,
      data: officeLocation,
    });
  })
);

/**
 * @route   POST /api/masters/office-locations
 * @desc    Create office location
 * @access  Private (TA, Admin)
 */
router.post(
  '/office-locations',
  authenticate,
  authorize('TA_TEAM', 'SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const officeLocation = await masterOfficeLocationService.createOfficeLocation(req.body);

    res.status(201).json({
      success: true,
      message: 'Office location created successfully',
      data: officeLocation,
    });
  })
);

/**
 * @route   PUT /api/masters/office-locations/:id
 * @desc    Update office location
 * @access  Private (TA, Admin)
 */
router.put(
  '/office-locations/:id',
  authenticate,
  authorize('TA_TEAM', 'SUPER_ADMIN'),
  validationRules.uuidParam('id'),
  validate,
  asyncHandler(async (req, res) => {
    const officeLocation = await masterOfficeLocationService.updateOfficeLocation(req.params.id, req.body);

    res.json({
      success: true,
      message: 'Office location updated successfully',
      data: officeLocation,
    });
  })
);

/**
 * @route   DELETE /api/masters/office-locations/:id
 * @desc    Delete office location
 * @access  Private (TA, Admin)
 */
router.delete(
  '/office-locations/:id',
  authenticate,
  authorize('TA_TEAM', 'SUPER_ADMIN'),
  validationRules.uuidParam('id'),
  validate,
  asyncHandler(async (req, res) => {
    await masterOfficeLocationService.deleteOfficeLocation(req.params.id);

    res.json({
      success: true,
      message: 'Office location deleted successfully',
    });
  })
);

module.exports = router;

