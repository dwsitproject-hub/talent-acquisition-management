const prisma = require('../config/database');
const logger = require('../utils/logger');

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

function startOfWeekMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7;
  d.setDate(d.getDate() - diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeekSunday(date) {
  const start = startOfWeekMonday(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function normalizeCurrentStatus(value) {
  return (value || '').trim().toLowerCase();
}

function isOpenCurrentStatus(value) {
  const s = normalizeCurrentStatus(value);
  if (!s) return true;
  return s === 'open' || s === 'pending fktk' || s === 're-open' || s === 'reopen';
}

function isClosedCurrentStatus(value) {
  const s = normalizeCurrentStatus(value);
  return s === 'close' || s === 'internal movement';
}


/**
 * Get dashboard statistics
 */
async function getDashboardStats(user = null) {
  try {
    // Build role-based filters
    const fptkWhere = {};
    const applicationWhere = {};
    const candidateWhere = {};

    if (user) {
      const userRole = user.role;
      const userDivision = user.division;
      const userPt = user.pt;
      const userArea = user.area;
      const userAreaDetail = user.areaDetail;

      if (userRole === 'HIRING_MANAGER') {
        const hmScope = buildHiringManagerScopeFromUser(user);
        if (hmScope) {
          Object.assign(fptkWhere, hmScope);
          applicationWhere.fptk = hmScope;
          candidateWhere.applications = {
            some: {
              fptk: hmScope,
            },
          };
        } else {
          fptkWhere.id = '00000000-0000-0000-0000-000000000000';
          applicationWhere.id = '00000000-0000-0000-0000-000000000000';
          candidateWhere.id = '00000000-0000-0000-0000-000000000000';
        }
      } else if ((userRole === 'Head of Division' || userRole === 'DEPARTMENT_HEAD') && userDivision) {
        fptkWhere.division = userDivision;
        applicationWhere.OR = [
          { fptk: { division: userDivision } },
          { candidate: { user: { division: userDivision } } }
        ];
        candidateWhere.user = { division: userDivision };
      } else if (userRole === 'HRBP') {
        // HRBP: All three fields must be present and match
        if (userPt && userArea && userAreaDetail) {
          fptkWhere.pt = userPt;
          fptkWhere.area = userArea;
          fptkWhere.areaDetail = userAreaDetail;
          
          applicationWhere.fptk = {
            pt: userPt,
            area: userArea,
            areaDetail: userAreaDetail,
          };
          
          candidateWhere.applications = {
            some: {
              fptk: {
                pt: userPt,
                area: userArea,
                areaDetail: userAreaDetail,
              },
            },
          };
        } else {
          // If any field is missing, return no results
          fptkWhere.id = '00000000-0000-0000-0000-000000000000';
          applicationWhere.id = '00000000-0000-0000-0000-000000000000';
          candidateWhere.id = '00000000-0000-0000-0000-000000000000';
        }
      }
    }

    // Get counts from database
    const [
      totalCandidates,
      totalFPTKs,
      activeFPTKs,
      publishedFPTKs,
      totalApplications,
      activeApplications,
      pendingInterviews,
    ] = await Promise.all([
      prisma.candidate.count({ where: candidateWhere }),
      prisma.fPTK.count({ where: fptkWhere }),
      prisma.fPTK.count({ where: { ...fptkWhere, isPublished: true } }),
      prisma.fPTK.count({ where: { ...fptkWhere, isPublished: true, status: { notIn: ['FILLED', 'CANCELLED'] } } }),
      prisma.application.count({ where: applicationWhere }),
      prisma.application.count({
        where: {
          ...applicationWhere,
          status: {
            in: ['SUBMITTED', 'SCREENING', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED'],
          },
        },
      }),
      prisma.interview.count({
        where: {
          status: {
            in: ['SCHEDULED', 'CONFIRMED'],
          },
          scheduledAt: {
            gte: new Date(),
          },
          ...(Object.keys(applicationWhere).length > 0 ? { application: applicationWhere } : {}),
        },
      }),
    ]);

    // Calculate position counts based on currentStatus
    // Open Position: NOT in ["Cancel", "Signing", "On Boarding"]
    // Closed Position: in ["Cancel", "Signing", "On Boarding"]
    const allFPTKsForCounts = await prisma.fPTK.findMany({
      where: fptkWhere,
      select: {
        currentStatus: true,
      },
    });

    // Debug: Log status distribution
    const statusCounts = {};
    allFPTKsForCounts.forEach((fptk) => {
      const status = (fptk.currentStatus || '').trim();
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    logger.info('Dashboard: FPTK status distribution:', JSON.stringify(statusCounts));

    const openPositionsCount = allFPTKsForCounts.filter((fptk) =>
      isOpenCurrentStatus(fptk.currentStatus)
    ).length;

    const closedPositionsCount = allFPTKsForCounts.filter((fptk) =>
      isClosedCurrentStatus(fptk.currentStatus)
    ).length;

    logger.info(`Dashboard: Position counts - Open: ${openPositionsCount}, Closed: ${closedPositionsCount}`);
    logger.info(`Dashboard: allFPTKsForCounts.length: ${allFPTKsForCounts.length}, fptkWhere keys: ${Object.keys(fptkWhere).join(', ')}`);

    // Interviews this week (Mon–Sun): applications in Interview Scheduled / Interviewed with interview in range
    const now = new Date();
    const weekStart = startOfWeekMonday(now);
    const weekEnd = endOfWeekSunday(now);

    const interviewStatusWhere = { status: { in: ['INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED'] } };
    const interviewsThisWeek =
      Object.keys(applicationWhere).length > 0
        ? await prisma.interview.count({
            where: {
              scheduledAt: {
                gte: weekStart,
                lte: weekEnd,
              },
              application: {
                AND: [interviewStatusWhere, applicationWhere],
              },
            },
          })
        : await prisma.interview.count({
            where: {
              scheduledAt: {
                gte: weekStart,
                lte: weekEnd,
              },
              application: interviewStatusWhere,
            },
          });

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const hiredThisMonth = await prisma.fPTK.count({
      where: {
        ...fptkWhere,
        OR: [{ currentStatus: 'Close' }, { currentStatus: 'close' }],
        updatedAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    // Fetch all FPTKs for dashboard charts
    const allFPTKs = await prisma.fPTK.findMany({
      where: fptkWhere,
      select: {
        id: true,
        areaDetail: true,
        area: true,
        requestDate: true,
        fptkReceiveDate: true,
        status: true,
        currentStatus: true,
      },
    });

    logger.info(`Dashboard: Fetched ${allFPTKs.length} FPTKs for charts`);

    // Helper function to get location (areaDetail or area or 'Unknown')
    const getLocation = (fptk) => {
      return fptk.areaDetail || fptk.area || 'Unknown';
    };

    // Helper function to get status for display (currentStatus or status or default)
    const getStatus = (fptk) => {
      // Use currentStatus if available, otherwise use status enum value, otherwise default
      if (fptk.currentStatus) {
        return fptk.currentStatus;
      }
      // Map FPTKStatus enum to display string
      const statusMap = {
        'DRAFT': 'Draft',
        'APPROVED': 'Approved',
        'OPEN': 'Open',
        'PARTIALLY_FILLED': 'Partially Filled',
        'FILLED': 'Filled',
        'CANCELLED': 'Cancelled',
        'EXPIRED': 'Expired',
      };
      return statusMap[fptk.status] || fptk.status || 'Raise FPTK';
    };

    // Location chart: green = actively open recruiting; red = everything else (Close, Cancel, etc.)
    const isClosed = (fptk) => !isOpenCurrentStatus(fptk.currentStatus || getStatus(fptk));

    // Calculate Position Status by Location
    const positionStatusByLocationMap = {};
    allFPTKs.forEach((fptk) => {
      const location = getLocation(fptk);
      if (!positionStatusByLocationMap[location]) {
        positionStatusByLocationMap[location] = {
          location,
          total: 0,
          closed: 0,
          open: 0,
        };
      }
      positionStatusByLocationMap[location].total += 1;
      if (isClosed(fptk)) {
        positionStatusByLocationMap[location].closed += 1;
      } else {
        positionStatusByLocationMap[location].open += 1;
      }
    });
    const positionStatusByLocation = Object.values(positionStatusByLocationMap);

    // Calculate Open Position Progress by Area Detail
    const openPositionProgressMap = {};
    allFPTKs.forEach((fptk) => {
      const areaDetail = getLocation(fptk);
      const status = getStatus(fptk);
      
      if (!openPositionProgressMap[areaDetail]) {
        openPositionProgressMap[areaDetail] = {
          areaDetail,
          statusCounts: {},
          total: 0,
        };
      }
      
      if (!openPositionProgressMap[areaDetail].statusCounts[status]) {
        openPositionProgressMap[areaDetail].statusCounts[status] = 0;
      }
      
      openPositionProgressMap[areaDetail].statusCounts[status] += 1;
      openPositionProgressMap[areaDetail].total += 1;
    });

    // Calculate percentages for each area detail
    const totalOpenPositions = allFPTKs.length;
    Object.values(openPositionProgressMap).forEach((areaData) => {
      areaData.percentage = totalOpenPositions > 0 
        ? Math.round((areaData.total / totalOpenPositions) * 100) 
        : 0;
    });
    const openPositionProgress = Object.values(openPositionProgressMap);

    // Calculate SLA by Location (from FPTK Receive Date, fallback to Request Date)
    const nowDate = new Date();
    const slaByLocationMap = {};
    allFPTKs.forEach((fptk) => {
      const areaDetail = getLocation(fptk);
      const referenceDate = fptk.fptkReceiveDate || fptk.requestDate;
      
      if (!slaByLocationMap[areaDetail]) {
        slaByLocationMap[areaDetail] = {
          areaDetail,
          buckets: {
            '0-30 Days': 0,
            '31-60 Days': 0,
            '61-90 Days': 0,
            'Above 91 Days': 0,
          },
          total: 0,
        };
      }
      
      if (referenceDate && !isNaN(new Date(referenceDate).getTime())) {
        const requestDateObj = new Date(referenceDate);
        const diffDays = Math.floor(
          (nowDate.getTime() - requestDateObj.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        if (diffDays <= 30) {
          slaByLocationMap[areaDetail].buckets['0-30 Days'] += 1;
        } else if (diffDays <= 60) {
          slaByLocationMap[areaDetail].buckets['31-60 Days'] += 1;
        } else if (diffDays <= 90) {
          slaByLocationMap[areaDetail].buckets['61-90 Days'] += 1;
        } else {
          slaByLocationMap[areaDetail].buckets['Above 91 Days'] += 1;
        }
        
        slaByLocationMap[areaDetail].total += 1;
      }
    });
    const slaByLocation = Object.values(slaByLocationMap);

    // Generate recent activity from candidates and FPTKs
    const recentCandidates = await prisma.candidate.findMany({
      where: candidateWhere,
      take: 3,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    const recentFPTKs = await prisma.fPTK.findMany({
      where: fptkWhere,
      take: 2,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        positionTitle: true,
        position: true,
        createdAt: true,
      },
    });

    const recentActivity = [
      ...recentCandidates.map((candidate) => ({
        type: 'candidate_added',
        message: `New candidate ${candidate.user.firstName} ${candidate.user.lastName} added`,
        timestamp: candidate.createdAt.toISOString(),
        icon: 'user',
      })),
      ...recentFPTKs.map((fptk) => ({
        type: 'job_posting_created',
        message: `New position "${fptk.positionTitle || fptk.position}" created`,
        timestamp: fptk.createdAt.toISOString(),
        icon: 'briefcase',
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);

    logger.info(`Dashboard: Calculated metrics - PositionStatusByLocation: ${positionStatusByLocation.length}, OpenPositionProgress: ${openPositionProgress.length}, SLAByLocation: ${slaByLocation.length}, RecentActivity: ${recentActivity.length}`);

    const result = {
      totalCandidates,
      totalFPTKs,
      activeFPTKs,
      openPositions: openPositionsCount,
      closedPositions: closedPositionsCount,
      totalApplications,
      activeApplications,
      pendingInterviews,
      interviewsThisWeek,
      hiredThisMonth,
      positionStatusByLocation,
      openPositionProgress,
      slaByLocation,
      recentActivity,
    };

    logger.info(`Dashboard: Result object keys: ${Object.keys(result).join(', ')}`);
    logger.info(`Dashboard: Result closedPositions: ${result.closedPositions}`);

    // Log sample data for debugging
    if (positionStatusByLocation.length > 0) {
      logger.info(`Dashboard: Sample positionStatusByLocation:`, JSON.stringify(positionStatusByLocation[0]));
    }
    if (openPositionProgress.length > 0) {
      logger.info(`Dashboard: Sample openPositionProgress:`, JSON.stringify(openPositionProgress[0]));
    }
    if (slaByLocation.length > 0) {
      logger.info(`Dashboard: Sample slaByLocation:`, JSON.stringify(slaByLocation[0]));
    }

    return result;
  } catch (error) {
    logger.error('Error fetching dashboard stats:', error);
    throw error;
  }
}

module.exports = {
  getDashboardStats,
};

