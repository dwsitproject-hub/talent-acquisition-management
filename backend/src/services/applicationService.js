const prisma = require('../config/database');
const { buildHrbpFptkFilterFromUser } = require('../utils/hrbpScope');
const logger = require('../utils/logger');

/**
 * Create application
 */
async function createApplication(candidateId, fptkId, data = {}) {
  // Check if candidate already applied for this position
  const existingApplication = await prisma.application.findFirst({
    where: {
      candidateId,
      fptkId,
      status: {
        notIn: ['REJECTED', 'WITHDRAWN'],
      },
    },
  });

  if (existingApplication) {
    throw new Error('You have already applied for this position');
  }

  // Check if FPTK is still open
  const fptk = await prisma.fPTK.findUnique({
    where: { id: fptkId },
  });

  if (!fptk) {
    throw new Error('Job position not found');
  }

  if (!fptk.isPublished || fptk.status === 'FILLED') {
    throw new Error('This position is no longer accepting applications');
  }

  const application = await prisma.application.create({
    data: {
      candidateId,
      fptkId,
      status: 'SUBMITTED',
      currentStage: 1, // Stage 1: FPTK Upload & Sync (submitted)
      source: data.source || 'Direct',
      referredBy: data.referredBy,
      appliedAt: new Date(),
    },
  });

  // Create status history
  await prisma.applicationStatusHistory.create({
    data: {
      applicationId: application.id,
      fromStatus: null,
      toStatus: 'SUBMITTED',
      reason: 'Application submitted',
    },
  });

  logger.info(`Application created: ${application.id} for FPTK: ${fptkId}`);

  return application;
}

/**
 * Get application by ID
 */
async function getApplicationById(applicationId) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      candidate: {
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
              phoneNumber: true,
            },
          },
          educations: true,
          workExperiences: {
            orderBy: { startDate: 'desc' },
          },
          certifications: true,
        },
      },
      fptk: {
        select: {
          fptkNumber: true,
          positionTitle: true,
          department: true,
          location: true,
          employmentType: true,
        },
      },
      tests: true,
      interviews: {
        include: {
          interviewer: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
      documents: true,
      offers: true,
      statusHistory: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!application) {
    throw new Error('Application not found');
  }

  return application;
}

/**
 * Get candidate's applications
 */
async function getCandidateApplications(candidateId, pagination) {
  const { page = 1, limit = 20 } = pagination;
  const skip = (page - 1) * limit;

  const [applications, total] = await Promise.all([
    prisma.application.findMany({
      where: { candidateId },
      skip,
      take: limit,
      include: {
        fptk: {
          select: {
            fptkNumber: true,
            positionTitle: true,
            department: true,
            location: true,
          },
        },
        _count: {
          select: {
            interviews: true,
            tests: true,
          },
        },
      },
      orderBy: { appliedAt: 'desc' },
    }),
    prisma.application.count({ where: { candidateId } }),
  ]);

  return {
    applications,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get all applications with filters (for TA/HR)
 */
async function getAllApplications(filters, pagination, user = null) {
  const { page = 1, limit = 20 } = pagination;
  const skip = (page - 1) * limit;

  const where = {};

  // Role-based filtering
  if (user) {
    const userRole = user.role;
    const userFirstName = user.firstName;
    const userDivision = user.division;
    if ((userRole === 'HIRING_MANAGER' || userRole === 'HIRING_MANAGER') && userFirstName) {
      // HIRING_MANAGER: only see candidates where Position.Hiring Manager = Team.First Name
      where.fptk = { hiringManager: userFirstName };
    } else if ((userRole === 'Head of Division' || userRole === 'DEPARTMENT_HEAD') && userDivision) {
      // Head of Division: only see candidates where Position.Division = Team.Division or Candidates.Division = Team.Division
      where.OR = [
        { fptk: { division: userDivision } },
        { candidate: { user: { division: userDivision } } }
      ];
    } else if (userRole === 'HRBP') {
      const hrbp = buildHrbpFptkFilterFromUser(user);
      if (hrbp) {
        where.fptk = hrbp;
      } else {
        where.id = '00000000-0000-0000-0000-000000000000'; // Non-existent ID to return empty results
      }
    }
    // SUPER_ADMIN, TA_TEAM, and other roles see all applications (no additional filtering)
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.fptkId) {
    where.fptkId = filters.fptkId;
  }

  if (filters.candidateId) {
    where.candidateId = filters.candidateId;
  }

  if (filters.department) {
    if (where.fptk) {
      where.fptk.department = filters.department;
    } else {
      where.fptk = { department: filters.department };
    }
  }

  if (filters.currentStage) {
    where.currentStage = parseInt(filters.currentStage);
  }

  if (filters.slaBreached === 'true') {
    where.slaBreached = true;
  }

  if (filters.search) {
    const searchConditions = [
      { candidate: { user: { firstName: { contains: filters.search, mode: 'insensitive' } } } },
      { candidate: { user: { lastName: { contains: filters.search, mode: 'insensitive' } } } },
      { candidate: { user: { email: { contains: filters.search, mode: 'insensitive' } } } },
      { applicationNumber: { contains: filters.search, mode: 'insensitive' } },
      { fptk: { positionTitle: { contains: filters.search, mode: 'insensitive' } } },
      { fptk: { department: { contains: filters.search, mode: 'insensitive' } } },
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

  const [applications, total] = await Promise.all([
    prisma.application.findMany({
      where,
      skip,
      take: limit,
      include: {
        candidate: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                phoneNumber: true,
              },
            },
          },
        },
        fptk: {
          select: {
            id: true,
            fptkNumber: true,
            positionTitle: true,
            department: true,
            priority: true,
          },
        },
        interviews: {
          include: {
            interviewer: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { scheduledAt: 'desc' },
        },
        offers: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { appliedAt: 'desc' },
    }),
    prisma.application.count({ where }),
  ]);

  return {
    applications,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Update application status
 */
async function updateApplicationStatus(applicationId, newStatus, userId, reason = null) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
  });

  if (!application) {
    throw new Error('Application not found');
  }

  const oldStatus = application.status;

  // Determine stage based on status
  const stageMapping = {
    'SUBMITTED': 1,
    'KEEP_IN_VIEW': 2,
    'SCREENING': 2,
    'PSYCHOMETRIC_TEST': 3,
    'TECHNICAL_TEST': 3,
    'INTERVIEW_SCHEDULED': 4,
    'INTERVIEW_COMPLETED': 4,
    'DOCUMENT_VERIFICATION': 5,
    'OFFER_PROPOSED': 6,
    'OFFER_APPROVED': 6,
    'OFFER_SENT': 6,
    'OFFER_ACCEPTED': 6,
    'MEDICAL_CHECKUP_SCHEDULED': 7,
    'MEDICAL_CHECKUP_COMPLETED': 7,
    'CONTRACT_SENT': 8,
    'CONTRACT_SIGNED': 8,
    'ONBOARDING': 9,
    'HIRED': 9,
  };

  const currentStage = stageMapping[newStatus] || application.currentStage;

  const updateData = {
    status: newStatus,
    currentStage,
  };

  // Update specific timestamp fields
  if (newStatus === 'SCREENING') {
    updateData.screenedAt = new Date();
  } else if (newStatus === 'INTERVIEW_COMPLETED') {
    updateData.interviewedAt = new Date();
  } else if (newStatus === 'OFFER_SENT') {
    updateData.offeredAt = new Date();
  } else if (newStatus === 'HIRED') {
    updateData.hiredAt = new Date();
  } else if (newStatus === 'REJECTED') {
    updateData.rejectedAt = new Date();
    updateData.rejectionReason = reason;
  } else if (newStatus === 'WITHDRAWN') {
    updateData.withdrawnAt = new Date();
  } else if (newStatus === 'KEEP_IN_VIEW') {
    updateData.rejectedAt = null;
    updateData.rejectionReason = null;
    updateData.withdrawnAt = null;
  }

  // Update application
  const updatedApplication = await prisma.application.update({
    where: { id: applicationId },
    data: updateData,
  });

  if (newStatus === 'ONBOARDING' && application.fptkId) {
    await prisma.fPTK.update({
      where: { id: application.fptkId },
      data: { currentStatus: 'Close' },
    });
  }

  // Create status history
  await prisma.applicationStatusHistory.create({
    data: {
      applicationId,
      fromStatus: oldStatus,
      toStatus: newStatus,
      changedBy: userId,
      reason,
    },
  });

  logger.info(`Application ${applicationId} status updated: ${oldStatus} -> ${newStatus}`);

  return updatedApplication;
}

/**
 * Withdraw application (by candidate)
 */
async function withdrawApplication(applicationId, candidateId) {
  const application = await prisma.application.findFirst({
    where: {
      id: applicationId,
      candidateId,
    },
  });

  if (!application) {
    throw new Error('Application not found');
  }

  if (['HIRED', 'REJECTED', 'WITHDRAWN'].includes(application.status)) {
    throw new Error('Cannot withdraw application in current status');
  }

  return await updateApplicationStatus(applicationId, 'WITHDRAWN', candidateId, 'Withdrawn by candidate');
}

/**
 * Shortlist candidates for next stage
 */
async function shortlistApplication(applicationId, userId) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
  });

  if (!application) {
    throw new Error('Application not found');
  }

  let newStatus;
  if (application.status === 'SUBMITTED') {
    newStatus = 'SCREENING';
  } else if (application.status === 'SCREENING') {
    newStatus = 'PSYCHOMETRIC_TEST';
  } else {
    throw new Error('Cannot shortlist from current status');
  }

  return await updateApplicationStatus(applicationId, newStatus, userId, 'Shortlisted for next stage');
}

/**
 * Reject application
 */
async function rejectApplication(applicationId, userId, reason) {
  return await updateApplicationStatus(applicationId, 'REJECTED', userId, reason);
}

/**
 * Get application statistics
 */
async function getApplicationStatistics(filters = {}) {
  const where = {};

  if (filters.fptkId) {
    where.fptkId = filters.fptkId;
  }

  if (filters.department) {
    where.fptk = { department: filters.department };
  }

  if (filters.dateFrom) {
    where.appliedAt = { gte: new Date(filters.dateFrom) };
  }

  if (filters.dateTo) {
    where.appliedAt = { ...where.appliedAt, lte: new Date(filters.dateTo) };
  }

  const [
    total,
    byStatus,
    byStage,
    slaBreached,
  ] = await Promise.all([
    prisma.application.count({ where }),
    prisma.application.groupBy({
      by: ['status'],
      where,
      _count: true,
    }),
    prisma.application.groupBy({
      by: ['currentStage'],
      where,
      _count: true,
    }),
    prisma.application.count({
      where: { ...where, slaBreached: true },
    }),
  ]);

  return {
    total,
    byStatus,
    byStage,
    slaBreached,
  };
}

module.exports = {
  createApplication,
  getApplicationById,
  getCandidateApplications,
  getAllApplications,
  updateApplicationStatus,
  withdrawApplication,
  shortlistApplication,
  rejectApplication,
  getApplicationStatistics,
};

