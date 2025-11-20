const prisma = require('../config/database');
const logger = require('../utils/logger');

const UI_STATUS_TO_APP_STATUS_MAP = {
  'applied': 'SUBMITTED',
  'submitted': 'SUBMITTED',
  'under review': 'SCREENING',
  'screening': 'SCREENING',
  'shortlisted': 'SCREENING',
  'cv screening': 'SCREENING',
  'interview scheduled': 'INTERVIEW_SCHEDULED',
  'interviewed': 'INTERVIEW_COMPLETED',
  'interview completed': 'INTERVIEW_COMPLETED',
  'document verification': 'DOCUMENT_VERIFICATION',
  'offer proposed': 'OFFER_PROPOSED',
  'offer approved': 'OFFER_APPROVED',
  'offer sent': 'OFFER_SENT',
  'offer extended': 'OFFER_PROPOSED',
  'offer accepted': 'OFFER_ACCEPTED',
  'offer declined': 'OFFER_REJECTED',
  'offer rejected': 'OFFER_REJECTED',
  'medical checkup scheduled': 'MEDICAL_CHECKUP_SCHEDULED',
  'medical checkup completed': 'MEDICAL_CHECKUP_COMPLETED',
  'contract sent': 'CONTRACT_SENT',
  'contract signed': 'CONTRACT_SIGNED',
  'on boarding': 'ONBOARDING',
  'onboarding': 'ONBOARDING',
  'hired': 'HIRED',
  'rejected': 'REJECTED',
  'withdrawn': 'WITHDRAWN',
};

const FPTK_RELATION_INCLUDE = {
  creator: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  applications: {
    orderBy: { appliedAt: 'asc' },
    include: {
      candidate: {
        select: {
          id: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
              division: true,
            },
          },
          skills: true,
          languages: true,
          currentJobTitle: true,
          currentCompany: true,
          currentAddress: true,
          formDataDiri: true,
        },
      },
      interviews: {
        include: {
          interviewer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { scheduledAt: 'asc' },
      },
    },
  },
  statusHistory: {
    orderBy: { createdAt: 'asc' },
  },
  _count: {
    select: {
      applications: true,
    },
  },
};

function mapUiStatusToApplicationStatus(status) {
  if (!status) return 'SUBMITTED';
  const normalized = status.toString().trim().toLowerCase();
  return UI_STATUS_TO_APP_STATUS_MAP[normalized] || 'SUBMITTED';
}

function normalizeAppliedCandidates(appliedCandidatesInput) {
  if (!appliedCandidatesInput) return [];
  const map = new Map();

  const pushCandidate = (candidateId, payload = {}) => {
    if (!candidateId) return;
    map.set(candidateId, {
      candidateId,
      status: payload.status,
      appliedAt: payload.appliedAt || payload.appliedDate || payload.appliedOn,
      source: payload.source,
      interviews: payload.interviews || [], // Preserve interview data
      rejectedDate: payload.rejectedDate || payload.rejectedAt || null,
      withdrawDate: payload.withdrawDate || payload.withdrawnDate || payload.withdrawnAt || null,
    });
  };

  if (Array.isArray(appliedCandidatesInput)) {
    appliedCandidatesInput.forEach((item) => {
      if (!item) return;
      if (typeof item === 'string') {
        pushCandidate(item);
      } else if (typeof item === 'object') {
        const candidateId = item.candidateId || item.id;
        pushCandidate(candidateId, item);
      }
    });
  } else if (typeof appliedCandidatesInput === 'string') {
    pushCandidate(appliedCandidatesInput);
  }

  return Array.from(map.values());
}

async function syncFptkApplicationsTx(tx, fptkId, appliedCandidates, options = {}) {
  if (!Array.isArray(appliedCandidates)) {
    return;
  }

  // Debug: Log received applied candidates to check interview data
  logger.info(`syncFptkApplicationsTx: Processing ${appliedCandidates.length} candidates for FPTK ${fptkId}`);
  appliedCandidates.forEach((candidate, index) => {
    if (candidate.interviews && candidate.interviews.length > 0) {
      logger.info(`Candidate ${index}: ${candidate.id || candidate.candidateId} has ${candidate.interviews.length} interviews`);
    }
  });

  const normalized = normalizeAppliedCandidates(appliedCandidates);

  if (normalized.length === 0) {
    await tx.application.deleteMany({
      where: { fptkId },
    });
    return;
  }

  const existingApplications = await tx.application.findMany({
    where: { fptkId },
  });

  const existingByCandidate = new Map(existingApplications.map((app) => [app.candidateId, app]));
  const incomingIds = new Set(normalized.map((item) => item.candidateId));

  const toDelete = existingApplications
    .filter((app) => !incomingIds.has(app.candidateId))
    .map((app) => app.id);

  if (toDelete.length > 0) {
    await tx.application.deleteMany({
      where: { id: { in: toDelete } },
    });
  }

  for (const item of normalized) {
    const candidateId = item.candidateId;
    if (!candidateId) continue;

    const existing = existingByCandidate.get(candidateId);
    const status = mapUiStatusToApplicationStatus(item.status);
    const appliedAt = item.appliedAt ? new Date(item.appliedAt) : (existing ? existing.appliedAt : new Date());
    const source = item.source || existing?.source || 'SUGGESTED';
    let rejectedAtValue = null;
    let withdrawnAtValue = null;

    if (status === 'REJECTED') {
      rejectedAtValue = item.rejectedDate ? new Date(item.rejectedDate) : new Date();
      withdrawnAtValue = null;
    } else if (status === 'WITHDRAWN') {
      withdrawnAtValue = item.withdrawDate ? new Date(item.withdrawDate) : new Date();
      rejectedAtValue = null;
    }

    let applicationId;
    if (existing) {
      await tx.application.update({
        where: { id: existing.id },
        data: {
          status,
          appliedAt,
          source,
          rejectedAt: typeof rejectedAtValue !== 'undefined' ? rejectedAtValue : undefined,
          withdrawnAt: typeof withdrawnAtValue !== 'undefined' ? withdrawnAtValue : undefined,
        },
      });
      applicationId = existing.id;
    } else {
      try {
        const newApplication = await tx.application.create({
          data: {
            candidateId,
            fptkId,
            status,
            appliedAt,
            source,
            appliedByUserId: options.userId || null,
            rejectedAt: typeof rejectedAtValue !== 'undefined' ? rejectedAtValue : undefined,
            withdrawnAt: typeof withdrawnAtValue !== 'undefined' ? withdrawnAtValue : undefined,
          },
        });
        applicationId = newApplication.id;
      } catch (error) {
        logger.warn(`Failed to create application for candidate ${candidateId} on FPTK ${fptkId}: ${error.message}`);
        continue; // Skip to next candidate if application creation failed
      }
    }

    // Handle interview data if provided
    if (applicationId && item.interviews && Array.isArray(item.interviews)) {
      logger.info(`Processing ${item.interviews.length} interviews for application ${applicationId}`);
      
      // Delete existing interviews for this application
      await tx.interview.deleteMany({
        where: { applicationId },
      });

      // Create new interviews from the provided data
      for (const interviewData of item.interviews) {
        logger.info(`Processing interview data:`, JSON.stringify(interviewData));
        // Skip empty interviews (all fields empty)
        if (!interviewData.interviewer && !interviewData.date && !interviewData.time && !interviewData.results) {
          continue;
        }

        try {
          // Parse date and time if provided
          let scheduledAt = new Date();
          if (interviewData.date) {
            const dateStr = interviewData.date;
            const timeStr = interviewData.time || '00:00';
            const [hours, minutes] = timeStr.split(':').map(Number);
            scheduledAt = new Date(dateStr);
            scheduledAt.setHours(hours || 0, minutes || 0, 0, 0);
          }

          // Determine interview status based on data
          let interviewStatus = 'SCHEDULED';
          if (interviewData.results && interviewData.results.trim()) {
            interviewStatus = 'COMPLETED';
          }

          // Try to find interviewer by name/email if interviewer field is provided
          let interviewerId = null;
          if (interviewData.interviewer && interviewData.interviewer.trim()) {
            // Try to find user by email or name
            const interviewerParts = interviewData.interviewer.trim().split(' ');
            const firstName = interviewerParts[0] || '';
            const lastName = interviewerParts.slice(1).join(' ') || '';
            
            const interviewer = await tx.user.findFirst({
              where: {
                OR: [
                  { email: { contains: interviewData.interviewer.trim(), mode: 'insensitive' } },
                  ...(firstName ? [{ firstName: { contains: firstName, mode: 'insensitive' } }] : []),
                  ...(lastName ? [{ lastName: { contains: lastName, mode: 'insensitive' } }] : []),
                ],
              },
              select: { id: true },
            });
            if (interviewer) {
              interviewerId = interviewer.id;
            }
          }

          await tx.interview.create({
            data: {
              applicationId,
              candidateId,
              interviewType: 'HR_INTERVIEW', // Default type, can be enhanced later
              status: interviewStatus,
              round: 1, // Default to round 1, can be enhanced later
              scheduledAt,
              duration: 60, // Default 60 minutes, can be enhanced later
              notes: interviewData.results || null,
              completedAt: interviewStatus === 'COMPLETED' ? new Date() : null,
              interviewerId,
              interviewerName: interviewData.interviewer && interviewData.interviewer.trim() ? interviewData.interviewer.trim() : null, // Store interviewer name even if no matching user found
            },
          });
        } catch (error) {
          logger.warn(`Failed to create interview for application ${applicationId}: ${error.message}`);
        }
      }
    }
  }
}

async function getFptkWithRelations(fptkId) {
  return prisma.fPTK.findUnique({
    where: { id: fptkId },
    include: FPTK_RELATION_INCLUDE,
  });
}

/**
 * Create FPTK
 */
async function createFPTK(data, creatorId) {
  const statusFktkNormalized = (data.statusFktk || '').trim().toLowerCase();
  let fptkNumber = (data.fptkNumber || data.noFktk || '').toString().trim();

  if (statusFktkNormalized === 'received' && !fptkNumber) {
    throw new Error('FPTK number (noFktk) is required when Status FKTK is Received');
  }

  if (fptkNumber) {
    const existing = await prisma.fPTK.findUnique({
      where: { fptkNumber },
    });

    if (existing) {
      throw new Error('FPTK number already exists');
    }
  } else {
    fptkNumber = null;
  }

  const appliedCandidatesProvided = data.appliedCandidates !== undefined || data.appliedCandidateIds !== undefined;
  const normalizedAppliedCandidates = appliedCandidatesProvided
    ? normalizeAppliedCandidates(data.appliedCandidates ?? data.appliedCandidateIds)
    : [];

  // Handle file upload if present (from express-fileupload middleware)
  let fptkFilePath = null;
  let fptkFileName = null;
  let fptkReceiveDate = null;
  
  // Handle file from req.files (express-fileupload) or data.fptkFile (if passed directly)
  const file = data.fptkFile || (data.files && data.files.fptkFile);
  if (file && file.name) {
    const path = require('path');
    const fs = require('fs');
    const uploadDir = path.join(__dirname, '../../uploads/fptk');
    
    // Ensure upload directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    // Generate unique filename
    const fileExt = path.extname(file.name);
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const fullPath = path.join(uploadDir, fileName);
    fptkFileName = file.name;
    
    // Save file asynchronously (express-fileupload provides .mv() method)
    if (file.mv) {
      try {
        await new Promise((resolve, reject) => {
          file.mv(fullPath, (err) => {
            if (err) reject(err);
            else resolve(true);
          });
        });
        fptkFilePath = `/uploads/fptk/${fileName}`;
      } catch (err) {
        logger.error(`Failed to save FPTK file: ${err.message}`);
      }
    } else if (file.data) {
      // Handle Buffer directly
      try {
        fs.writeFileSync(fullPath, file.data);
        fptkFilePath = `/uploads/fptk/${fileName}`;
      } catch (err) {
        logger.error(`Failed to save FPTK file: ${err.message}`);
      }
    }
  }
  
  // Handle fptkReceiveDate
  if (data.fptkReceiveDate) {
    try {
      fptkReceiveDate = new Date(data.fptkReceiveDate);
      if (isNaN(fptkReceiveDate.getTime())) {
        fptkReceiveDate = new Date();
      }
    } catch (e) {
      fptkReceiveDate = new Date();
    }
  }

  // Map frontend fields to database fields
  const fptkData = {
    fptkNumber,
    pt: data.pt,
    noFktk: data.noFktk ? data.noFktk.trim() : null,
    statusFktk: data.statusFktk,
    division: data.division,
    section: data.section,
    hiringManager: data.hiringManager,
    position: data.position || data.positionTitle,
    positionTitle: data.positionTitle || data.position,
    department: data.department || data.division,
    location: data.location || data.area,
    employmentType: data.employmentType,
    typeGrade: data.typeGrade,
    grade2: data.grade2,
    level: data.level || data.typeGrade,
    priority: data.priority || data.urgentNormal || null,
    priorityByMonthYear: data.priorityByMonthYear || null,
    isPriority: data.priority === 'P0' || data.urgentNormal === 'P0',
    jobSpecification: data.jobSpecification || data.description,
    criteria: data.criteria,
    area: data.area,
    areaDetail: data.areaDetail,
    additionalOrReplacement: data.additionalOrReplacement,
    replacementName: data.replacementName,
    resignReason: data.resignReason,
    totalRequest: data.totalRequest ? parseInt(data.totalRequest) : 1,
    // Use currentStatus from data, don't fall back to statusFktk
    // If not provided, default to 'Raise FPTK'
    currentStatus: data.currentStatus || 'Raise FPTK',
    requestDate: (data.requestDate && data.requestDate.toString().trim() !== '') 
      ? (() => {
          try {
            const date = new Date(data.requestDate);
            // Check if date is valid
            if (isNaN(date.getTime())) {
              return new Date(); // Use today's date if invalid
            }
            return date;
          } catch (e) {
            return new Date(); // Use today's date if error
          }
        })()
      : new Date(), // Use today's date if empty
    // FPTK File Information
    fptkFilePath: fptkFilePath,
    fptkFileName: fptkFileName,
    fptkReceiveDate: fptkReceiveDate,
    // Legacy fields
    numberOfPositions: data.numberOfPositions ? parseInt(data.numberOfPositions) : (data.totalRequest ? parseInt(data.totalRequest) : 1),
    filledPositions: 0,
    minEducation: data.minEducation,
    minExperience: data.minExperience,
    requiredSkills: data.requiredSkills || data.skills || [],
    jobDescription: data.jobDescription || data.jobSpecification || data.description,
    responsibilities: data.responsibilities,
    qualifications: data.qualifications || data.criteria,
    salaryRangeMin: data.salaryRangeMin,
    salaryRangeMax: data.salaryRangeMax,
    benefits: data.benefits,
    requestedBy: data.requestedBy || data.hiringManager,
    status: data.status || 'DRAFT',
    // Don't set createdBy here - we'll use connect for the relation
    remark: data.remark,
  };

  // Remove undefined fields
  Object.keys(fptkData).forEach(key => {
    if (fptkData[key] === undefined) {
      delete fptkData[key];
    }
  });

  if (!creatorId) {
    throw new Error('Creator ID is required');
  }

  // Verify creator exists
  const creator = await prisma.user.findUnique({
    where: { id: creatorId },
    select: { id: true },
  });

  if (!creator) {
    throw new Error('Creator user not found');
  }

  const createdFptk = await prisma.$transaction(async (tx) => {
    // Use connect for the creator relation - Prisma will automatically set createdBy
    // Make sure createdBy is not in fptkData (we removed it earlier, but just in case)
    const createData = { ...fptkData };
    // Remove createdBy if it exists (it shouldn't, but just in case)
    delete createData.createdBy;
    // Add the creator relation
    createData.creator = {
      connect: { id: creatorId }
    };
    
    const fptk = await tx.fPTK.create({
      data: createData,
    });

    // Create initial status history entry
    await tx.fPTKStatusHistory.create({
      data: {
        fptkId: fptk.id,
        fromStatus: null,
        toStatus: fptk.currentStatus || 'Raise FPTK',
        changedBy: creatorId,
        reason: 'FPTK created',
        startDate: new Date(),
      },
    });

    if (appliedCandidatesProvided) {
      await syncFptkApplicationsTx(tx, fptk.id, normalizedAppliedCandidates, { userId: creatorId });
    }

    return fptk;
  });

  logger.info(`FPTK created: ${createdFptk.fptkNumber || createdFptk.id} by user ${creatorId}`);

  const enriched = await getFptkWithRelations(createdFptk.id);
  return enriched || createdFptk;
}

/**
 * Get FPTK by ID
 */
async function getFPTKById(fptkId) {
  const fptk = await getFptkWithRelations(fptkId);

  if (!fptk) {
    throw new Error('FPTK not found');
  }

  return fptk;
}

/**
 * Get all FPTKs with filters
 */
async function getAllFPTKs(filters, pagination, user = null) {
  const { page = 1, limit = 20 } = pagination;
  const skip = (page - 1) * limit;

  const where = {};

  // Role-based filtering
  if (user) {
    const userRole = user.role;
    const userFirstName = user.firstName;
    const userDivision = user.division;
    const userPt = user.pt;
    const userArea = user.area;
    const userAreaDetail = user.areaDetail;

      if ((userRole === 'HIRING_MANAGER' || userRole === 'HIRING_MANAGER') && userFirstName) {
        // HIRING_MANAGER: only see positions where Position.Hiring Manager = Team.First Name
        where.hiringManager = userFirstName;
      } else if ((userRole === 'Head of Division' || userRole === 'DEPARTMENT_HEAD') && userDivision) {
        // Head of Division: only see positions where Position.Division = Team.Division
        where.division = userDivision;
    } else if (userRole === 'HRBP') {
      // HRBP: only see positions where Position.PT = Team.PT AND Position.Area = Team.Area AND Position.Area Detail = Team.Area Detail
      // All three fields must be present and match
      if (userPt && userArea && userAreaDetail) {
        where.pt = userPt;
        where.area = userArea;
        where.areaDetail = userAreaDetail;
      } else {
        // If any field is missing, return no results (HRBP must have all three fields)
        where.id = '00000000-0000-0000-0000-000000000000'; // Non-existent ID to return empty results
      }
    }
    // SUPER_ADMIN, TA_TEAM, and other roles see all positions (no additional filtering)
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.department) {
    where.department = filters.department;
  }

  if (filters.isPublished !== undefined) {
    where.isPublished = filters.isPublished === 'true';
  }

  if (filters.search) {
    const searchConditions = [
      { fptkNumber: { contains: filters.search, mode: 'insensitive' } },
      { positionTitle: { contains: filters.search, mode: 'insensitive' } },
      { position: { contains: filters.search, mode: 'insensitive' } },
      { department: { contains: filters.search, mode: 'insensitive' } },
      { division: { contains: filters.search, mode: 'insensitive' } },
    ];
    // If where.OR already exists (from role filtering), combine with AND
    if (where.OR) {
      where.AND = [
        { OR: where.OR },
        { OR: searchConditions }
      ];
      delete where.OR;
    } else {
      where.OR = searchConditions;
    }
  }

  if (filters.division) {
    where.division = filters.division;
  }

  if (filters.priority) {
    where.priority = filters.priority;
  }

  const [fptks, total] = await Promise.all([
    prisma.fPTK.findMany({
      where,
      skip,
      take: limit,
      include: FPTK_RELATION_INCLUDE,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.fPTK.count({ where }),
  ]);

  return {
    fptks,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Update FPTK
 */
async function updateFPTK(fptkId, data, updaterId) {
  const current = await prisma.fPTK.findUnique({
    where: { id: fptkId },
  });

  if (!current) {
    throw new Error('FPTK not found');
  }

  const statusFktkNormalized = ((data.statusFktk !== undefined ? data.statusFktk : current.statusFktk) || '')
    .toString()
    .trim()
    .toLowerCase();

  const incomingNumberRaw =
    data.fptkNumber !== undefined
      ? data.fptkNumber
      : data.noFktk !== undefined
        ? data.noFktk
        : undefined;

  const incomingNumber = incomingNumberRaw !== undefined ? incomingNumberRaw.toString().trim() : undefined;

  const effectiveNumber =
    incomingNumber !== undefined && incomingNumber !== ''
      ? incomingNumber
      : (current.fptkNumber || current.noFktk || '').toString().trim();

  if (statusFktkNormalized === 'received' && !effectiveNumber) {
    throw new Error('FPTK number (noFktk) is required when Status FKTK is Received');
  }

  if (incomingNumber !== undefined && incomingNumber !== '') {
    const existing = await prisma.fPTK.findFirst({
      where: {
        fptkNumber: incomingNumber,
        NOT: { id: fptkId },
      },
    });

    if (existing) {
      throw new Error('FPTK number already exists');
    }
  }

  const appliedCandidatesProvided = data.appliedCandidates !== undefined || data.appliedCandidateIds !== undefined;
  const normalizedAppliedCandidates = appliedCandidatesProvided
    ? normalizeAppliedCandidates(data.appliedCandidates ?? data.appliedCandidateIds)
    : [];

  // Map frontend fields to database fields
  const updateData = {};

  // Map all fields similar to create
  if (data.pt !== undefined) updateData.pt = data.pt;
  if (data.noFktk !== undefined || data.fptkNumber !== undefined) {
    const numberValue =
      incomingNumber !== undefined
        ? incomingNumber
        : undefined;

    if (data.noFktk !== undefined) {
      updateData.noFktk = numberValue || null;
    }

    if (data.fptkNumber !== undefined || data.noFktk !== undefined) {
      updateData.fptkNumber = numberValue || null;
    }
  }
  if (data.statusFktk !== undefined) updateData.statusFktk = data.statusFktk;
  if (data.division !== undefined) updateData.division = data.division;
  if (data.section !== undefined) updateData.section = data.section;
  if (data.hiringManager !== undefined) updateData.hiringManager = data.hiringManager;
  if (data.position !== undefined) {
    updateData.position = data.position;
    updateData.positionTitle = data.position;
  }
  if (data.department !== undefined) updateData.department = data.department;
  if (data.location !== undefined) updateData.location = data.location;
  if (data.employmentType !== undefined) updateData.employmentType = data.employmentType;
  if (data.typeGrade !== undefined) updateData.typeGrade = data.typeGrade;
  if (data.grade2 !== undefined) updateData.grade2 = data.grade2;
  if (data.level !== undefined) updateData.level = data.level;
  if (data.priority !== undefined) {
    updateData.priority = data.priority;
    updateData.isPriority = data.priority === 'P0';
  }
  if (data.priorityByMonthYear !== undefined) updateData.priorityByMonthYear = data.priorityByMonthYear;
  if (data.jobSpecification !== undefined) updateData.jobSpecification = data.jobSpecification;
  if (data.criteria !== undefined) updateData.criteria = data.criteria;
  if (data.area !== undefined) updateData.area = data.area;
  if (data.areaDetail !== undefined) updateData.areaDetail = data.areaDetail;
  if (data.additionalOrReplacement !== undefined) updateData.additionalOrReplacement = data.additionalOrReplacement;
  if (data.replacementName !== undefined) updateData.replacementName = data.replacementName;
  if (data.resignReason !== undefined) updateData.resignReason = data.resignReason;
  if (data.totalRequest !== undefined) {
    updateData.totalRequest = parseInt(data.totalRequest);
    updateData.numberOfPositions = parseInt(data.totalRequest);
  }
  if (data.currentStatus !== undefined) updateData.currentStatus = data.currentStatus;
  if (data.requestDate !== undefined) updateData.requestDate = new Date(data.requestDate);
  if (data.status !== undefined) updateData.status = data.status;
  if (data.remark !== undefined) updateData.remark = data.remark;
  if (data.requiredSkills !== undefined) updateData.requiredSkills = data.requiredSkills;

  // Handle FPTK file upload if present (from express-fileupload middleware)
  // Only update file fields if a new file is explicitly provided
  const file = data.fptkFile || (data.files && data.files.fptkFile);
  if (file && file.name) {
    const path = require('path');
    const fs = require('fs');
    const uploadDir = path.join(__dirname, '../../uploads/fptk');
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const fileExt = path.extname(file.name);
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const fullPath = path.join(uploadDir, fileName);
    updateData.fptkFileName = file.name;
    
    if (file.mv) {
      try {
        await new Promise((resolve, reject) => {
          file.mv(fullPath, (err) => {
            if (err) reject(err);
            else resolve(true);
          });
        });
        updateData.fptkFilePath = `/uploads/fptk/${fileName}`;
      } catch (err) {
        logger.error(`Failed to save FPTK file: ${err.message}`);
      }
    } else if (file.data) {
      try {
        fs.writeFileSync(fullPath, file.data);
        updateData.fptkFilePath = `/uploads/fptk/${fileName}`;
      } catch (err) {
        logger.error(`Failed to save FPTK file: ${err.message}`);
      }
    }
  }
  // If no new file is provided, preserve existing file fields (don't clear them)
  // Prisma will preserve fields that are not in updateData, so we don't need to do anything here
  
  // Handle fptkReceiveDate - only update if explicitly provided (not undefined/null/empty)
  if (data.fptkReceiveDate !== undefined && data.fptkReceiveDate !== null && data.fptkReceiveDate !== '') {
    try {
      updateData.fptkReceiveDate = new Date(data.fptkReceiveDate);
      if (isNaN(updateData.fptkReceiveDate.getTime())) {
        // Invalid date - don't update, preserve existing
        logger.warn(`Invalid fptkReceiveDate provided: ${data.fptkReceiveDate}`);
      }
    } catch (e) {
      // Error parsing date - don't update, preserve existing
      logger.warn(`Error parsing fptkReceiveDate: ${e.message}`);
    }
  }
  // If fptkReceiveDate is undefined/null/empty, don't update it (preserve existing)

  // Legacy fields
  if (data.minEducation !== undefined) updateData.minEducation = data.minEducation;
  if (data.minExperience !== undefined) updateData.minExperience = data.minExperience;
  if (data.jobDescription !== undefined) updateData.jobDescription = data.jobDescription;
  if (data.responsibilities !== undefined) updateData.responsibilities = data.responsibilities;
  if (data.qualifications !== undefined) updateData.qualifications = data.qualifications;

  const updatedFptk = await prisma.$transaction(async (tx) => {
    // Get current FPTK to check for status change
    const currentFptk = await tx.fPTK.findUnique({
      where: { id: fptkId },
      select: { currentStatus: true },
    });

    const fptk = await tx.fPTK.update({
      where: { id: fptkId },
      data: updateData,
    });

    // Track status change if currentStatus changed
    if (data.currentStatus !== undefined && data.currentStatus !== currentFptk?.currentStatus) {
      // End the previous status history entry
      const previousStatus = await tx.fPTKStatusHistory.findFirst({
        where: {
          fptkId: fptkId,
          toStatus: currentFptk?.currentStatus || 'Raise FPTK',
          endDate: null,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (previousStatus) {
        await tx.fPTKStatusHistory.update({
          where: { id: previousStatus.id },
          data: { endDate: new Date() },
        });
      }

      // Create new status history entry
      await tx.fPTKStatusHistory.create({
        data: {
          fptkId: fptkId,
          fromStatus: currentFptk?.currentStatus || null,
          toStatus: data.currentStatus,
          changedBy: updaterId,
          reason: data.statusChangeReason || 'Status updated',
          startDate: new Date(),
        },
      });
    }

    if (appliedCandidatesProvided) {
      await syncFptkApplicationsTx(tx, fptkId, normalizedAppliedCandidates, { userId: updaterId });
    }

    return fptk;
  });

  logger.info(`FPTK updated: ${fptkId}`);

  const enriched = await getFptkWithRelations(updatedFptk.id);
  return enriched || updatedFptk;
}

/**
 * Publish FPTK (make visible to candidates)
 */
async function publishFPTK(fptkId) {
  const fptk = await prisma.fPTK.update({
    where: { id: fptkId },
    data: {
      isPublished: true,
      publishedAt: new Date(),
      status: 'OPEN',
    },
  });

  logger.info(`FPTK published: ${fptkId}`);

  return fptk;
}

/**
 * Unpublish FPTK
 */
async function unpublishFPTK(fptkId) {
  const fptk = await prisma.fPTK.update({
    where: { id: fptkId },
    data: {
      isPublished: false,
    },
  });

  logger.info(`FPTK unpublished: ${fptkId}`);

  return fptk;
}

/**
 * Get published FPTKs (for candidate portal)
 */
async function getPublishedFPTKs(filters, pagination) {
  const { page = 1, limit = 20 } = pagination;
  const skip = (page - 1) * limit;

  const where = {
    isPublished: true,
    status: 'OPEN',
  };

  if (filters.department) {
    where.department = filters.department;
  }

  if (filters.location) {
    where.location = { contains: filters.location, mode: 'insensitive' };
  }

  if (filters.employmentType) {
    where.employmentType = filters.employmentType;
  }

  if (filters.search) {
    where.OR = [
      { positionTitle: { contains: filters.search, mode: 'insensitive' } },
      { jobDescription: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [fptks, total] = await Promise.all([
    prisma.fPTK.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true,
        fptkNumber: true,
        positionTitle: true,
        department: true,
        location: true,
        employmentType: true,
        level: true,
        numberOfPositions: true,
        filledPositions: true,
        minEducation: true,
        minExperience: true,
        requiredSkills: true,
        jobDescription: true,
        responsibilities: true,
        qualifications: true,
        salaryRangeMin: true,
        salaryRangeMax: true,
        benefits: true,
        publishedAt: true,
      },
      orderBy: [
        { isPriority: 'desc' },
        { publishedAt: 'desc' },
      ],
    }),
    prisma.fPTK.count({ where }),
  ]);

  return {
    jobs: fptks,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Update FPTK filled positions count
 */
async function updateFilledPositions(fptkId) {
  const fptk = await prisma.fPTK.findUnique({
    where: { id: fptkId },
    include: {
      _count: {
        select: {
          applications: {
            where: { status: 'HIRED' },
          },
        },
      },
    },
  });

  if (!fptk) {
    throw new Error('FPTK not found');
  }

  const filledPositions = fptk._count.applications;
  const status = filledPositions >= fptk.numberOfPositions ? 'FILLED' : 
                 filledPositions > 0 ? 'PARTIALLY_FILLED' : 'OPEN';

  await prisma.fPTK.update({
    where: { id: fptkId },
    data: {
      filledPositions,
      status,
    },
  });

  logger.info(`FPTK ${fptkId} filled positions updated: ${filledPositions}/${fptk.numberOfPositions}`);
}

module.exports = {
  createFPTK,
  getFPTKById,
  getAllFPTKs,
  updateFPTK,
  publishFPTK,
  unpublishFPTK,
  getPublishedFPTKs,
  updateFilledPositions,
};

