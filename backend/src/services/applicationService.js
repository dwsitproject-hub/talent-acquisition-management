const prisma = require('../config/database');
const logger = require('../utils/logger');
const { buildTokenizedSearch } = require('../utils/search');
const { withActiveCandidateOnApplication } = require('../utils/candidateVisibility');
const { assertCandidateCanApplyToPosition } = require('../utils/candidateApplicationLock');
const { buildHrbpApplicationFptkFilterFromUser } = require('../utils/hrbpScope');
const { isDepartmentHeadRole, buildHodApplicationScopeFromUser } = require('../utils/hodScope');
const { mapUiStatusToApplicationStatus } = require('../utils/applicationStatus');

function forbidden(message) {
  const err = new Error(message || 'Insufficient permissions');
  err.statusCode = 403;
  return err;
}

async function assertUserCanAccessApplication(user, applicationId) {
  if (!user) {
    throw forbidden('Unauthorized');
  }

  const role = user.role;
  if (['SUPER_ADMIN', 'TA_HO'].includes(role)) {
    return;
  }

  if (role === 'HRBP' || role === 'TA_SITE') {
    const scope = buildHrbpApplicationFptkFilterFromUser(user);
    if (!scope) {
      throw forbidden('Missing PT/Area scope for this user');
    }
    const allowed = await prisma.application.findFirst({
      where: {
        id: applicationId,
        ...scope,
      },
      select: { id: true },
    });
    if (!allowed) {
      throw forbidden('You can only update applications within your assigned scope');
    }
    return;
  }

  if (isDepartmentHeadRole(role)) {
    const scope = buildHodApplicationScopeFromUser(user);
    if (!scope) {
      throw forbidden('Missing division scope for this user');
    }
    const allowed = await prisma.application.findFirst({
      where: {
        id: applicationId,
        ...scope,
      },
      select: { id: true },
    });
    if (!allowed) {
      throw forbidden('You can only update applications within your assigned division');
    }
    return;
  }

  throw forbidden('Insufficient permissions');
}

function buildHiringManagerScopeFromUser(user = null) {
  if (!user) return null;

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

  await assertCandidateCanApplyToPosition(prisma, candidateId, fptkId);

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

  // Resolve the submitter's display name if userId is provided
  let submitterName = null;
  if (data.userId) {
    const submitter = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { firstName: true, lastName: true },
    });
    if (submitter) {
      submitterName = [submitter.firstName, submitter.lastName].filter(Boolean).join(' ') || null;
    }
  }

  // Create status history
  await prisma.applicationStatusHistory.create({
    data: {
      applicationId: application.id,
      fromStatus: null,
      toStatus: 'SUBMITTED',
      changedByName: submitterName || 'Candidate',
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

  if (!application || application.candidate?.isDeleted) {
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

  const activeCandidate = await prisma.candidate.findFirst({
    where: { id: candidateId, isDeleted: false },
    select: { id: true },
  });
  if (!activeCandidate) {
    return {
      applications: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0,
      },
    };
  }

  const [applications, total] = await Promise.all([
    prisma.application.findMany({
      where: { candidateId },
      skip,
      take: limit,
      include: {
        fptk: {
          select: {
            fptkNumber: true,
            position: true,
            positionTitle: true,
            department: true,
            location: true,
          },
        },
        statusHistory: {
          orderBy: { createdAt: 'asc' },
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

    if (userRole === 'HIRING_MANAGER') {
      // HIRING_MANAGER: only see candidates where Position.Hiring Manager = Team.First Name
      const hmScope = buildHiringManagerScopeFromUser(user);
      if (hmScope) {
        where.fptk = hmScope;
      } else {
        where.id = '00000000-0000-0000-0000-000000000000';
      }
    } else if (isDepartmentHeadRole(userRole)) {
      const hodScope = buildHodApplicationScopeFromUser(user);
      if (hodScope) {
        Object.assign(where, hodScope);
      } else {
        where.id = '00000000-0000-0000-0000-000000000000';
      }
    } else if (userRole === 'HRBP' || userRole === 'TA_SITE') {
      const hrbpScope = buildHrbpApplicationFptkFilterFromUser(user);
      if (hrbpScope) {
        Object.assign(where, hrbpScope);
      } else {
        where.id = '00000000-0000-0000-0000-000000000000';
      }
    }
    // SUPER_ADMIN, TA_HO, and other roles see all applications (no additional filtering)
  }

  if (filters.status) {
    const statuses = String(filters.status).split(',').map((s) => s.trim()).filter(Boolean);
    where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
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

  const tokenizedSearch = buildTokenizedSearch(filters, (token) => ([
    { candidate: { user: { firstName: { contains: token, mode: 'insensitive' } } } },
    { candidate: { user: { lastName: { contains: token, mode: 'insensitive' } } } },
    { candidate: { user: { email: { contains: token, mode: 'insensitive' } } } },
    { applicationNumber: { contains: token, mode: 'insensitive' } },
    { fptk: { positionTitle: { contains: token, mode: 'insensitive' } } },
    { fptk: { department: { contains: token, mode: 'insensitive' } } },
  ]));

  if (tokenizedSearch) {
    // If where.OR already exists (from role filtering), combine with AND
    if (where.OR) {
      where.AND = [
        { OR: where.OR },
        tokenizedSearch,
      ];
      delete where.OR;
    } else if (tokenizedSearch.AND) {
      where.AND = tokenizedSearch.AND;
    } else {
      where.OR = tokenizedSearch.OR;
    }
  }

  const activeWhere = withActiveCandidateOnApplication(where);

  const [applications, total] = await Promise.all([
    prisma.application.findMany({
      where: activeWhere,
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
            position: true,
            positionTitle: true,
            department: true,
            division: true,
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
    prisma.application.count({ where: activeWhere }),
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
async function updateApplicationStatus(applicationId, newStatus, userId, reason = null, options = {}) {
  const user = options.user || null;
  if (user) {
    await assertUserCanAccessApplication(user, applicationId);
  }

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
  });

  if (!application) {
    throw new Error('Application not found');
  }

  const oldStatus = application.status;

  newStatus = mapUiStatusToApplicationStatus(newStatus, oldStatus);

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

  // Resolve the actor's display name for the audit trail
  let changedByName = null;
  if (userId) {
    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, role: true },
    });
    if (actor) {
      const name = [actor.firstName, actor.lastName].filter(Boolean).join(' ').trim();
      changedByName = name || null;
    }
  }

  // Create status history
  await prisma.applicationStatusHistory.create({
    data: {
      applicationId,
      fromStatus: oldStatus,
      toStatus: newStatus,
      changedBy: userId,
      changedByName,
      reason,
    },
  });

  if (options.blacklisted === true || options.blacklisted === false) {
    await prisma.candidate.update({
      where: { id: application.candidateId },
      data: {
        blacklisted: options.blacklisted,
        blacklistReason: options.blacklisted
          ? (options.blacklistReason || reason || null)
          : null,
      },
    });
  }

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

  const activeWhere = withActiveCandidateOnApplication(where);

  const [
    total,
    byStatus,
    byStage,
    slaBreached,
  ] = await Promise.all([
    prisma.application.count({ where: activeWhere }),
    prisma.application.groupBy({
      by: ['status'],
      where: activeWhere,
      _count: true,
    }),
    prisma.application.groupBy({
      by: ['currentStage'],
      where: activeWhere,
      _count: true,
    }),
    prisma.application.count({
      where: { ...activeWhere, slaBreached: true },
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

