const prisma = require('../config/database');
const logger = require('../utils/logger');

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
      const userFirstName = user.firstName;
      const userDivision = user.division;
      const userPt = user.pt;
      const userArea = user.area;
      const userAreaDetail = user.areaDetail;

      if ((userRole === 'HIRING_MANAGER' || userRole === 'HIRING_MANAGER') && userFirstName) {
        fptkWhere.hiringManager = userFirstName;
        applicationWhere.fptk = { hiringManager: userFirstName };
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
      pendingOffers,
      hiredThisMonth,
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
      (async () => {
        const offerWhere = {
          status: {
            in: ['PENDING_HRBP_REVIEW', 'PENDING_HEAD_APPROVAL', 'SENT_TO_CANDIDATE'],
          },
        };
        if (Object.keys(applicationWhere).length > 0) {
          offerWhere.application = applicationWhere;
        }
        return prisma.offer.count({ where: offerWhere });
      })(),
      prisma.application.count({
        where: {
          ...applicationWhere,
          status: 'HIRED',
          hiredAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
    ]);

    // Calculate interviews this week
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() - dayOfWeek + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const interviewsThisWeek = await prisma.interview.count({
      where: {
        scheduledAt: {
          gte: startOfWeek,
          lte: endOfWeek,
        },
        status: {
          in: ['SCHEDULED', 'CONFIRMED'],
        },
      },
    });

    // Fetch all FPTKs for dashboard charts
    const allFPTKs = await prisma.fPTK.findMany({
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

    // Helper function to check if status is closed
    const isClosed = (fptk) => {
      const status = getStatus(fptk);
      const dbStatus = fptk.status;
      // Closed if status contains 'On Boarding', 'Cancelled', 'Filled', or database status is FILLED or CANCELLED
      const statusLower = status.toLowerCase();
      return (
        statusLower.includes('on boarding') ||
        statusLower.includes('boarding') ||
        statusLower === 'cancelled' ||
        statusLower === 'filled' ||
        dbStatus === 'FILLED' ||
        dbStatus === 'CANCELLED'
      );
    };

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
      openPositions: publishedFPTKs,
      totalApplications,
      activeApplications,
      pendingInterviews,
      interviewsThisWeek,
      pendingOffers,
      hiredThisMonth,
      positionStatusByLocation,
      openPositionProgress,
      slaByLocation,
      recentActivity,
    };

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

