const express = require('express');
const router = express.Router();
const { authenticate, authorize, checkOwnership } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const candidateService = require('../services/candidateService');
const prisma = require('../config/database');
const { validationRules, validate } = require('../middleware/validator');
const { uploadLimiter } = require('../middleware/rateLimiter');
const documentService = require('../services/documentService');
const candidateFormTokenService = require('../services/candidateFormTokenService');
const { parseSpreadsheet, sendTemplate } = require('../utils/spreadsheet');
const bulkImportService = require('../services/bulkImportService');

function buildHiringManagerFptkScope(user = {}) {
  const firstName = String(user.firstName || '').trim();
  const lastName = String(user.lastName || '').trim();
  const email = String(user.email || '').trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const values = Array.from(new Set([firstName, fullName, email].filter(Boolean)));
  if (values.length === 0) return null;
  return {
    OR: values.map((value) => ({
      hiringManager: { equals: value, mode: 'insensitive' },
    })),
  };
}

/**
 * @route   GET /api/candidates/me
 * @desc    Get current candidate profile
 * @access  Private (Candidate)
 */
router.get('/me', authenticate, authorize('CANDIDATE'), asyncHandler(async (req, res) => {
  const candidate = await candidateService.getCandidateByUserId(req.user.id);
  
  res.json({
    success: true,
    data: candidate,
  });
}));

/**
 * @route   PUT /api/candidates/me
 * @desc    Update candidate profile
 * @access  Private (Candidate)
 */
router.put(
  '/me',
  authenticate,
  authorize('CANDIDATE'),
  validationRules.updateCandidateProfile,
  validate,
  asyncHandler(async (req, res) => {
    const candidate = await candidateService.getCandidateByUserId(req.user.id);
    const updated = await candidateService.updateCandidateProfile(candidate.id, req.body);
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updated,
    });
  })
);

/**
 * @route   POST /api/candidates/me/education
 * @desc    Add education
 * @access  Private (Candidate)
 */
router.post('/me/education', authenticate, authorize('CANDIDATE'), asyncHandler(async (req, res) => {
  const candidate = await candidateService.getCandidateByUserId(req.user.id);
  const education = await candidateService.addEducation(candidate.id, req.body);
  
  res.status(201).json({
    success: true,
    message: 'Education added successfully',
    data: education,
  });
}));

/**
 * @route   POST /api/candidates/me/experience
 * @desc    Add work experience
 * @access  Private (Candidate)
 */
router.post('/me/experience', authenticate, authorize('CANDIDATE'), asyncHandler(async (req, res) => {
  const candidate = await candidateService.getCandidateByUserId(req.user.id);
  const experience = await candidateService.addWorkExperience(candidate.id, req.body);
  
  res.status(201).json({
    success: true,
    message: 'Work experience added successfully',
    data: experience,
  });
}));

/**
 * @route   POST /api/candidates/me/certification
 * @desc    Add certification
 * @access  Private (Candidate)
 */
router.post('/me/certification', authenticate, authorize('CANDIDATE'), asyncHandler(async (req, res) => {
  const candidate = await candidateService.getCandidateByUserId(req.user.id);
  const certification = await candidateService.addCertification(candidate.id, req.body);
  
  res.status(201).json({
    success: true,
    message: 'Certification added successfully',
    data: certification,
  });
}));

/**
 * @route   POST /api/candidates/me/reference
 * @desc    Add reference
 * @access  Private (Candidate)
 */
router.post('/me/reference', authenticate, authorize('CANDIDATE'), asyncHandler(async (req, res) => {
  const candidate = await candidateService.getCandidateByUserId(req.user.id);
  const reference = await candidateService.addReference(candidate.id, req.body);
  
  res.status(201).json({
    success: true,
    message: 'Reference added successfully',
    data: reference,
  });
}));

/**
 * @route   POST /api/candidates
 * @desc    Create new candidate (for TA/HR)
 * @access  Private (TA, HRBP, Admin)
 */
router.post(
  '/',
  authenticate,
  authorize('TA_HO', 'HRBP', 'TA_SITE', 'SUPER_ADMIN', 'CHRO'),
  asyncHandler(async (req, res) => {
    console.log('CREATE CANDIDATE - Received data:', JSON.stringify(req.body, null, 2));
    try {
      const candidate = await candidateService.createCandidate(req.body);
      console.log('CREATE CANDIDATE - Created candidate:', JSON.stringify({
        id: candidate.id,
        division: candidate.user?.division,
        positionAppliedFor: candidate.positionAppliedFor,
        ethnicity: candidate.ethnicity,
        healthStatus: candidate.healthStatus
      }, null, 2));
      
      // Ensure the response is serializable
      const responseData = {
        success: true,
        message: 'Candidate created successfully',
        data: candidate,
      };
      
      res.status(201).json(responseData);
    } catch (error) {
      console.error('CREATE CANDIDATE - Error in route handler:', error);
      throw error; // Let asyncHandler handle it
    }
  })
);

/**
 * @route   GET /api/candidates/bulk-template
 * @desc    Download candidate bulk upload template (CSV/XLSX)
 * @access  Private (TA, HRBP, Admin)
 */
router.get(
  '/bulk-template',
  authenticate,
  authorize('TA_HO', 'HRBP', 'TA_SITE', 'SUPER_ADMIN', 'CHRO'),
  asyncHandler(async (req, res) => {
    const format = (req.query.format || 'csv').toString();
    return sendTemplate(res, {
      filenameBase: 'candidates-upload-template',
      format,
      headers: ['Name', 'Email', 'Phone Number', 'Position Applied For', 'Division'],
    });
  })
);

/**
 * @route   POST /api/candidates/bulk-upload
 * @desc    Bulk upload candidates from CSV/XLSX
 * @access  Private (TA, HRBP, Admin)
 */
router.post(
  '/bulk-upload',
  authenticate,
  authorize('TA_HO', 'HRBP', 'TA_SITE', 'SUPER_ADMIN', 'CHRO'),
  uploadLimiter,
  asyncHandler(async (req, res) => {
    if (!req.files || !req.files.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please attach a file field named "file".',
      });
    }

    const { rows } = parseSpreadsheet(req.files.file.data);
    const result = await bulkImportService.importCandidates(rows);

    return res.status(200).json({
      success: true,
      message: 'Candidate bulk upload processed',
      data: result,
    });
  })
);

/**
 * @route   GET /api/candidates
 * @desc    Search candidates
 * @access  Private (TA, HRBP, Admin)
 */
router.get(
  '/',
  authenticate,
  authorize('TA_HO', 'HRBP', 'TA_SITE', 'SUPER_ADMIN', 'CHRO', 'DEPARTMENT_HEAD', 'HIRING_MANAGER'),
  validationRules.pagination,
  validate,
  asyncHandler(async (req, res) => {
    const filters = {
      search: req.query.search,
      skills: req.query.skills ? req.query.skills.split(',') : undefined,
      minScore: req.query.minScore,
      forFptkId: req.query.forFptkId || undefined,
    };
    
    const pagination = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
    };
    
    const result = await candidateService.searchCandidates(filters, pagination, req.user);
    
    res.json({
      success: true,
      data: result.candidates,
      pagination: result.pagination,
    });
  })
);

/**
 * @route   PUT /api/candidates/:id
 * @desc    Update candidate (admin/TA)
 * @access  Private (TA, HRBP, Admin)
 */
router.put(
  '/:id',
  authenticate,
  authorize('TA_HO', 'HRBP', 'TA_SITE', 'SUPER_ADMIN', 'CHRO'),
  validationRules.uuidParam('id'),
  validate,
  asyncHandler(async (req, res) => {
    console.log('UPDATE CANDIDATE - Received data:', JSON.stringify(req.body, null, 2));
    const updated = await candidateService.updateCandidate(req.params.id, req.body);
    console.log('UPDATE CANDIDATE - Updated candidate:', JSON.stringify({
      id: updated.id,
      division: updated.user?.division,
      positionAppliedFor: updated.positionAppliedFor,
      ethnicity: updated.ethnicity,
      healthStatus: updated.healthStatus
    }, null, 2));
    res.json({ success: true, message: 'Candidate updated', data: updated });
  })
);

/**
 * @route   DELETE /api/candidates/:id
 * @desc    Soft-delete candidate (hidden from lists; retained in DB)
 * @access  Private (TA, HRBP, Admin, CHRO)
 */
router.delete(
  '/:id',
  authenticate,
  authorize('TA_HO', 'HRBP', 'TA_SITE', 'SUPER_ADMIN', 'CHRO'),
  validationRules.uuidParam('id'),
  validate,
  asyncHandler(async (req, res) => {
    const result = await candidateService.softDeleteCandidate(req.params.id, req.user.id);
    res.json({
      success: true,
      message: 'Candidate deleted successfully',
      data: result,
    });
  })
);

/**
 * @route   POST /api/candidates/:id/documents
 * @desc    Upload candidate document (e.g., CV)
 * @access  Private (TA, HRBP, Admin)
 */
router.post(
  '/:id/documents',
  authenticate,
  authorize('TA_HO', 'HRBP', 'TA_SITE', 'SUPER_ADMIN', 'CHRO'),
  uploadLimiter,
  validationRules.uuidParam('id'),
  validate,
  asyncHandler(async (req, res) => {
    const candidateId = req.params.id;

    if (!req.files || !req.files.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please attach a file field named "file".',
      });
    }

    const documentType = req.body.type || 'RESUME';
    const baseUrl = process.env.API_BASE_URL || `${req.protocol}://${req.get('host')}`;

    const uploadedDocument = await documentService.uploadCandidateDocument(candidateId, req.files.file, {
      documentType,
      baseUrl,
    });

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      data: uploadedDocument,
    });
  })
);

/**
 * @route   POST /api/candidates/:id/form-link
 * @desc    Generate candidate form link
 * @access  Private (TA, HRBP, Admin)
 */
router.post(
  '/:id/form-link',
  authenticate,
  authorize('TA_HO', 'HRBP', 'TA_SITE', 'SUPER_ADMIN', 'CHRO'),
  validationRules.uuidParam('id'),
  validate,
  asyncHandler(async (req, res) => {
    const candidateId = req.params.id;
    const expiresInDays = Number(req.body.expiresInDays) || 7;

    const candidate = await candidateService.getCandidateProfile(candidateId);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found',
      });
    }

    const tokenRecord = await candidateFormTokenService.createCandidateFormToken(candidateId, { expiresInDays });
    const baseUrl = (process.env.CANDIDATE_FORM_URL
      || process.env.FRONTEND_URL
      || process.env.CANDIDATE_PORTAL_URL
      || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const link = `${baseUrl}/candidate-form/${tokenRecord.token}`;

    res.status(201).json({
      success: true,
      message: 'Candidate form link generated',
      data: {
        id: tokenRecord.id,
        candidateId: tokenRecord.candidateId,
        token: tokenRecord.token,
        link,
        createdAt: tokenRecord.createdAt,
        expiresAt: tokenRecord.expiresAt,
        submittedAt: tokenRecord.submittedAt,
        isActive: !tokenRecord.submittedAt,
      },
    });
  })
);

/**
 * @route   GET /api/candidates/by-token/:token
 * @desc    Get candidate by token (public endpoint for candidate form)
 * @access  Public
 */
router.get(
  '/by-token/:token',
  asyncHandler(async (req, res) => {
    const token = req.params.token;

    try {
      const tokenRecord = await candidateFormTokenService.validateCandidateFormToken(token);
      const candidate = await candidateService.getCandidateProfile(tokenRecord.candidateId);

      res.json({
        success: true,
        data: {
          candidate,
          token: {
            token: tokenRecord.token,
            expiresAt: tokenRecord.expiresAt,
            submittedAt: tokenRecord.submittedAt,
            createdAt: tokenRecord.createdAt,
          },
        },
      });
    } catch (error) {
      res.status(error.statusCode || 400).json({
        success: false,
        message: error.message || 'Invalid or expired link',
      });
    }
  })
);

/**
 * @route   PUT /api/candidates/by-token/:token
 * @desc    Update candidate form data by token (public endpoint for candidate form submission)
 * @access  Public
 */
router.put(
  '/by-token/:token',
  asyncHandler(async (req, res) => {
    const token = req.params.token;

    try {
      const tokenRecord = await candidateFormTokenService.validateCandidateFormToken(token);
      const formData = req.body.formData || {};

    const updateData = {
      placeOfBirth: formData.placeOfBirth,
      dateOfBirth: formData.dateOfBirth ? new Date(formData.dateOfBirth) : null,
      gender: formData.gender,
      maritalStatus: formData.maritalStatus,
        height: formData.height ? parseInt(formData.height, 10) : null,
        weight: formData.weight ? parseInt(formData.weight, 10) : null,
      npwpNumber: formData.taxNumber,
      bpjsHealthNumber: formData.bpjsNumber,
      currentAddress: formData.currentAddress,
      permanentAddress: formData.permanentAddress,
      emergencyContact: formData.emergencyContactName,
      emergencyPhone: formData.emergencyPhoneNo,
      emergencyRelation: formData.emergencyRelation,
      expectedSalary: formData.expectedSalary ? parseFloat(formData.expectedSalary) : null,
      availableFrom: formData.availableStartDate ? new Date(formData.availableStartDate) : null,
        drivingLicense: Array.isArray(formData.drivingLicense)
          ? formData.drivingLicense
          : (formData.drivingLicense ? [formData.drivingLicense] : []),
        formDataDiri: {
          ...formData,
          submittedAt: new Date().toISOString(),
        },
      };

      const updated = await candidateService.updateCandidateProfile(tokenRecord.candidateId, updateData);
      await candidateFormTokenService.markCandidateFormTokenSubmitted(token);
    
    res.json({
      success: true,
      message: 'Form submitted successfully',
      data: updated,
    });
    } catch (error) {
      res.status(error.statusCode || 400).json({
        success: false,
        message: error.message || 'Failed to submit form',
      });
    }
  })
);

/**
 * @route   GET /api/candidates/:id
 * @desc    Get candidate by ID
 * @access  Private (TA, HRBP, Admin)
 */
router.get(
  '/:id',
  authenticate,
  authorize('TA_HO', 'HRBP', 'TA_SITE', 'SUPER_ADMIN', 'CHRO', 'HIRING_MANAGER', 'DEPARTMENT_HEAD'),
  validationRules.uuidParam('id'),
  validate,
  asyncHandler(async (req, res) => {
    const userRole = req.user.role;
    if (userRole === 'DEPARTMENT_HEAD' || userRole === 'Head of Division') {
      const allowed = await prisma.candidate.findFirst({
        where: {
          id: req.params.id,
          isDeleted: false,
          user: { division: req.user.division || '' },
        },
        select: { id: true },
      });
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: 'You can only access candidates in your division',
        });
      }
    } else if (userRole === 'HIRING_MANAGER') {
      const hmScope = buildHiringManagerFptkScope(req.user);
      if (!hmScope) {
        return res.status(403).json({
          success: false,
          message: 'Missing hiring manager identity for candidate access',
        });
      }
      const allowed = await prisma.candidate.findFirst({
        where: {
          id: req.params.id,
          isDeleted: false,
          applications: {
            some: {
              fptk: hmScope,
            },
          },
        },
        select: { id: true },
      });
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: 'You can only access candidates linked to your positions',
        });
      }
    }

    const candidate = await candidateService.getCandidateProfile(req.params.id, {
      forFptkId: req.query.forFptkId || undefined,
    });
    console.log('GET CANDIDATE - Returning candidate:', JSON.stringify({
      id: candidate.id,
      division: candidate.user?.division,
      positionAppliedFor: candidate.positionAppliedFor,
      ethnicity: candidate.ethnicity,
      healthStatus: candidate.healthStatus,
      languages: candidate.languages
    }, null, 2));
    
    res.json({
      success: true,
      data: candidate,
    });
  })
);

module.exports = router;

