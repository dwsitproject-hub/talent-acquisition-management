const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const applicationService = require('../services/applicationService');
const candidateService = require('../services/candidateService');
const { validationRules, validate } = require('../middleware/validator');

/**
 * @route   POST /api/applications
 * @desc    Create new application (apply for job)
 * @access  Private (Candidate)
 */
router.post(
  '/',
  authenticate,
  authorize('CANDIDATE'),
  validationRules.createApplication,
  validate,
  asyncHandler(async (req, res) => {
    const candidate = await candidateService.getCandidateByUserId(req.user.id);
    const application = await applicationService.createApplication(
      candidate.id,
      req.body.fptkId,
      req.body
    );
    
    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: application,
    });
  })
);

/**
 * @route   GET /api/applications/my
 * @desc    Get current candidate's applications
 * @access  Private (Candidate)
 */
router.get(
  '/my',
  authenticate,
  authorize('CANDIDATE'),
  validationRules.pagination,
  validate,
  asyncHandler(async (req, res) => {
    const candidate = await candidateService.getCandidateByUserId(req.user.id);
    
    const pagination = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
    };
    
    const result = await applicationService.getCandidateApplications(candidate.id, pagination);
    
    res.json({
      success: true,
      data: result.applications,
      pagination: result.pagination,
    });
  })
);

/**
 * @route   GET /api/applications
 * @desc    Get all applications (with filters)
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
      fptkId: req.query.fptkId,
      candidateId: req.query.candidateId,
      department: req.query.department,
      currentStage: req.query.currentStage,
      slaBreached: req.query.slaBreached,
      search: req.query.search,
    };
    
    const pagination = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
    };
    
    const result = await applicationService.getAllApplications(filters, pagination, req.user);
    
    res.json({
      success: true,
      data: result.applications,
      pagination: result.pagination,
    });
  })
);

/**
 * @route   GET /api/applications/:id
 * @desc    Get application by ID
 * @access  Private
 */
router.get(
  '/:id',
  authenticate,
  validationRules.uuidParam('id'),
  validate,
  asyncHandler(async (req, res) => {
    const application = await applicationService.getApplicationById(req.params.id);
    
    // Check if candidate can access their own application
    if (req.user.role === 'CANDIDATE') {
      const candidate = await candidateService.getCandidateByUserId(req.user.id);
      if (application.candidateId !== candidate.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }
    }
    
    res.json({
      success: true,
      data: application,
    });
  })
);

/**
 * @route   PUT /api/applications/:id/status
 * @desc    Update application status
 * @access  Private (TA, HRBP, Admin)
 */
router.put(
  '/:id/status',
  authenticate,
  authorize('TA_HO', 'HRBP', 'TA_SITE', 'SUPER_ADMIN'),
  validationRules.uuidParam('id'),
  validate,
  asyncHandler(async (req, res) => {
    const { status, reason } = req.body;
    const application = await applicationService.updateApplicationStatus(
      req.params.id,
      status,
      req.user.id,
      reason
    );
    
    res.json({
      success: true,
      message: 'Application status updated successfully',
      data: application,
    });
  })
);

/**
 * @route   POST /api/applications/:id/shortlist
 * @desc    Shortlist application for next stage
 * @access  Private (TA, Admin)
 */
router.post(
  '/:id/shortlist',
  authenticate,
  authorize('TA_HO', 'SUPER_ADMIN'),
  validationRules.uuidParam('id'),
  validate,
  asyncHandler(async (req, res) => {
    const application = await applicationService.shortlistApplication(req.params.id, req.user.id);
    
    res.json({
      success: true,
      message: 'Application shortlisted successfully',
      data: application,
    });
  })
);

/**
 * @route   POST /api/applications/:id/reject
 * @desc    Reject application
 * @access  Private (TA, HRBP, Admin)
 */
router.post(
  '/:id/reject',
  authenticate,
  authorize('TA_HO', 'HRBP', 'TA_SITE', 'SUPER_ADMIN'),
  validationRules.uuidParam('id'),
  validate,
  asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const application = await applicationService.rejectApplication(req.params.id, req.user.id, reason);
    
    res.json({
      success: true,
      message: 'Application rejected',
      data: application,
    });
  })
);

/**
 * @route   POST /api/applications/:id/withdraw
 * @desc    Withdraw application
 * @access  Private (Candidate)
 */
router.post(
  '/:id/withdraw',
  authenticate,
  authorize('CANDIDATE'),
  validationRules.uuidParam('id'),
  validate,
  asyncHandler(async (req, res) => {
    const candidate = await candidateService.getCandidateByUserId(req.user.id);
    const application = await applicationService.withdrawApplication(req.params.id, candidate.id);
    
    res.json({
      success: true,
      message: 'Application withdrawn successfully',
      data: application,
    });
  })
);

/**
 * @route   GET /api/applications/stats/overview
 * @desc    Get application statistics
 * @access  Private (TA, HRBP, Admin, CHRO)
 */
router.get(
  '/stats/overview',
  authenticate,
  authorize('TA_HO', 'HRBP', 'TA_SITE', 'SUPER_ADMIN', 'CHRO'),
  asyncHandler(async (req, res) => {
    const filters = {
      fptkId: req.query.fptkId,
      department: req.query.department,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
    };
    
    const stats = await applicationService.getApplicationStatistics(filters);
    
    res.json({
      success: true,
      data: stats,
    });
  })
);

module.exports = router;

