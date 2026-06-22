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


/** Convert a Prisma groupBy result array to a plain { key: count } map. */
function groupByToMap(rows, keyField) {
  if (!rows || !Array.isArray(rows)) return {};
  const map = {};
  rows.forEach((row) => {
    const key = (row[keyField] != null ? row[keyField] : '').toString();
    map[key] = row._count?._all ?? 0;
  });
  return map;
}

/**
 * Safely add a Prisma WHERE condition without overwriting an existing top-level OR.
 * Wraps the existing OR in AND so both conditions are enforced.
 */
function addConditionToWhere(where, condition) {
  if (!condition || Object.keys(condition).length === 0) return;
  if (where.OR) {
    const existingOr = { OR: where.OR };
    delete where.OR;
    where.AND = [...(where.AND || []), existingOr, condition];
  } else {
    Object.assign(where, condition);
  }
}

/** FPTK date window: updatedAt or createdAt within [start, end]. */
function buildFptkDateCondition(start, end) {
  if (!start || !end) return null;
  const ps = new Date(start);
  const pe = new Date(end);
  if (isNaN(ps.getTime()) || isNaN(pe.getTime())) return null;
  return {
    OR: [
      { updatedAt: { gte: ps, lte: pe } },
      { createdAt: { gte: ps, lte: pe } },
    ],
  };
}

/** UI Area filter (Site / HO) with legacy location-field fallback. */
function buildAreaFilterCondition(areaFilter) {
  const target = (areaFilter || '').trim();
  if (!target || target.toUpperCase() === 'ALL') return null;

  const normalized = target.toLowerCase();
  const emptyArea = { OR: [{ area: null }, { area: '' }] };

  if (normalized === 'ho') {
    return {
      OR: [
        { area: { equals: 'HO', mode: 'insensitive' } },
        {
          AND: [emptyArea, { location: { equals: 'Head Office', mode: 'insensitive' } }],
        },
      ],
    };
  }
  if (normalized === 'site') {
    return {
      OR: [
        { area: { equals: 'Site', mode: 'insensitive' } },
        {
          AND: [emptyArea, { location: { equals: 'Site', mode: 'insensitive' } }],
        },
      ],
    };
  }
  return null;
}

/** Parse comma-separated areaDetail list from query string; null = no filter. */
function parseAreaDetailsParam(areaDetailsParam) {
  if (areaDetailsParam === undefined || areaDetailsParam === null) return null;
  return String(areaDetailsParam)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Prisma condition for areaDetail IN list; empty array = match nothing. */
function buildAreaDetailsFilterCondition(details) {
  if (details === null) return null;
  if (details.length === 0) {
    return { id: '00000000-0000-0000-0000-000000000000' };
  }
  return { areaDetail: { in: details } };
}

/** Resolve canonical area label from FPTK row (area column, then location fallback). */
function resolveNormalizedArea(fptk) {
  const area = (fptk?.area || '').trim();
  if (area) return area;
  const loc = (fptk?.location || '').trim().toLowerCase();
  if (loc === 'head office') return 'HO';
  if (loc === 'site') return 'Site';
  return '';
}

/** Location display key — always prefer areaDetail over raw area code. */
function getLocationKey(fptk) {
  const detail = (fptk?.areaDetail || '').trim();
  if (detail) return detail;
  return 'Unassigned';
}

function cloneWhere(where) {
  return JSON.parse(JSON.stringify(where));
}

/**
 * Get dashboard statistics.
 * @param {object|null} user - authenticated user (for role-based scoping)
 * @param {object} [options={}] - optional UI-level filters and period params
 * @param {string} [options.priority]       - FPTK priority ('P0'|'P1'|'P2'; omit/'ALL' = no filter)
 * @param {string} [options.positionStatus] - 'OPEN'|'CLOSED'; omit for all positions
 * @param {string} [options.area]           - 'Site'|'HO'; omit/'ALL' = no area filter
 * @param {string} [options.areaDetails]    - comma-separated areaDetail values; empty string = no matches
 * @param {string} [options.periodStart]    - ISO date: start of current period (enables WoW groupBy)
 * @param {string} [options.periodEnd]      - ISO date: end of current period
 * @param {string} [options.previousStart]  - ISO date: start of previous period
 * @param {string} [options.previousEnd]    - ISO date: end of previous period
 */
async function getDashboardStats(user = null, options = {}) {
  try {
    // Build role-based filters
    const fptkWhere = {};
    const applicationWhere = {};
    const candidateWhere = { isDeleted: false };

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

    // Apply optional UI-level filters on top of role scope
    if (options.priority && options.priority !== 'ALL') {
      fptkWhere.priority = options.priority;

      // Scope application counts to only those belonging to priority-matched FPTKs
      if (applicationWhere.fptk) {
        // HIRING_MANAGER (fptk has OR) or HRBP (fptk has plain fields) — AND the priority in
        applicationWhere.fptk = { AND: [applicationWhere.fptk, { priority: options.priority }] };
      } else {
        // Head of Division (top-level OR) or no role scope — add fptk.priority condition
        addConditionToWhere(applicationWhere, { fptk: { priority: options.priority } });
      }
    }
    if (options.positionStatus === 'OPEN') {
      addConditionToWhere(fptkWhere, {
        OR: [
          { currentStatus: null },
          { currentStatus: { equals: 'Open', mode: 'insensitive' } },
          { currentStatus: { equals: 'Pending FKTK', mode: 'insensitive' } },
          { currentStatus: { equals: 'Re-Open', mode: 'insensitive' } },
          { currentStatus: { equals: 'Reopen', mode: 'insensitive' } },
        ],
      });
    } else if (options.positionStatus === 'CLOSED') {
      addConditionToWhere(fptkWhere, {
        OR: [
          { currentStatus: { equals: 'Close', mode: 'insensitive' } },
          { currentStatus: { equals: 'Internal Movement', mode: 'insensitive' } },
        ],
      });
    }

    const areaFilterCondition = buildAreaFilterCondition(options.area);
    if (areaFilterCondition) {
      addConditionToWhere(fptkWhere, areaFilterCondition);
      if (applicationWhere.fptk) {
        applicationWhere.fptk = { AND: [applicationWhere.fptk, areaFilterCondition] };
      } else {
        addConditionToWhere(applicationWhere, { fptk: areaFilterCondition });
      }
    }

    const parsedAreaDetails = parseAreaDetailsParam(options.areaDetails);
    if (parsedAreaDetails !== null) {
      const areaDetailsCondition = buildAreaDetailsFilterCondition(parsedAreaDetails);
      addConditionToWhere(fptkWhere, areaDetailsCondition);
      if (applicationWhere.fptk) {
        applicationWhere.fptk = { AND: [applicationWhere.fptk, areaDetailsCondition] };
      } else {
        addConditionToWhere(applicationWhere, { fptk: areaDetailsCondition });
      }
    }

    // Location charts: same scope as cards (priority/status/area) + current period when Compare is on
    const fptkLocationWhere = cloneWhere(fptkWhere);
    const locationPeriodCondition = buildFptkDateCondition(options.periodStart, options.periodEnd);
    if (locationPeriodCondition) {
      addConditionToWhere(fptkLocationWhere, locationPeriodCondition);
    }

    // Compute all date ranges upfront (before any DB queries)
    const now = new Date();
    const weekStart = startOfWeekMonday(now);
    const weekEnd = endOfWeekSunday(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const interviewStatusFilter = { status: { in: ['INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED'] } };
    const interviewsThisWeekWhere = {
      scheduledAt: { gte: weekStart, lte: weekEnd },
      application:
        Object.keys(applicationWhere).length > 0
          ? { AND: [interviewStatusFilter, applicationWhere] }
          : interviewStatusFilter,
    };

    // Build optional period groupBy queries (resolve to [] when not requested).
    // Uses updatedAt-or-createdAt for FPTKs and updatedAt-or-appliedAt for applications so
    // records that were created within the period but never subsequently updated are included.
    const buildPeriodGroupBys = (start, end) => {
      const fptkDateCondition = buildFptkDateCondition(start, end);
      if (!fptkDateCondition) return [Promise.resolve([]), Promise.resolve([])];

      const ps = new Date(start);
      const pe = new Date(end);
      const appDateCondition = {
        OR: [
          { updatedAt: { gte: ps, lte: pe } },
          { appliedAt: { gte: ps, lte: pe } },
        ],
      };

      const fptkPeriodWhere = cloneWhere(fptkWhere);
      addConditionToWhere(fptkPeriodWhere, fptkDateCondition);

      const appPeriodWhere = { ...applicationWhere };
      addConditionToWhere(appPeriodWhere, appDateCondition);

      return [
        prisma.fPTK.groupBy({ by: ['currentStatus'], where: fptkPeriodWhere, _count: { _all: true } }),
        prisma.application.groupBy({ by: ['status'], where: appPeriodWhere, _count: { _all: true } }),
      ];
    };
    const [currentPeriodFptkQ, currentPeriodAppQ] = buildPeriodGroupBys(options.periodStart, options.periodEnd);
    const [previousPeriodFptkQ, previousPeriodAppQ] = buildPeriodGroupBys(options.previousStart, options.previousEnd);

    // Single parallel round-trip for ALL DB work (previously 9 sequential round-trips)
    const [
      totalCandidates,
      totalFPTKs,
      activeFPTKs,
      publishedFPTKs,
      totalApplications,
      activeApplications,
      pendingInterviews,
      interviewsThisWeek,
      hiredThisMonth,
      locationFPTKs,
      recentCandidates,
      recentFPTKs,
      fptkGroupedAll,
      appGroupedAll,
      fptkGroupedCurrentPeriod,
      appGroupedCurrentPeriod,
      fptkGroupedPreviousPeriod,
      appGroupedPreviousPeriod,
    ] = await Promise.all([
      prisma.candidate.count({ where: candidateWhere }),
      prisma.fPTK.count({ where: fptkWhere }),
      prisma.fPTK.count({ where: { ...fptkWhere, isPublished: true } }),
      prisma.fPTK.count({ where: { ...fptkWhere, isPublished: true, status: { notIn: ['FILLED', 'CANCELLED'] } } }),
      prisma.application.count({ where: applicationWhere }),
      prisma.application.count({
        where: {
          ...applicationWhere,
          status: { in: ['SUBMITTED', 'SCREENING', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED'] },
        },
      }),
      prisma.interview.count({
        where: {
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
          scheduledAt: { gte: now },
          ...(Object.keys(applicationWhere).length > 0 ? { application: applicationWhere } : {}),
        },
      }),
      prisma.interview.count({ where: interviewsThisWeekWhere }),
      prisma.fPTK.count({
        where: {
          ...fptkWhere,
          currentStatus: { equals: 'close', mode: 'insensitive' },
          updatedAt: { gte: monthStart, lte: monthEnd },
        },
      }),
      prisma.fPTK.findMany({
        where: fptkLocationWhere,
        select: {
          id: true,
          areaDetail: true,
          area: true,
          location: true,
          requestDate: true,
          fptkReceiveDate: true,
          statusFktk: true,
          status: true,
          currentStatus: true,
        },
      }),
      prisma.candidate.findMany({
        where: candidateWhere,
        take: 3,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      }),
      prisma.fPTK.findMany({
        where: fptkWhere,
        take: 2,
        orderBy: { createdAt: 'desc' },
        select: { id: true, positionTitle: true, position: true, createdAt: true },
      }),
      // All-time grouped counts for stat card headlines
      prisma.fPTK.groupBy({ by: ['currentStatus'], where: fptkWhere, _count: { _all: true } }),
      prisma.application.groupBy({ by: ['status'], where: applicationWhere, _count: { _all: true } }),
      // Optional period-filtered grouped counts for WoW comparison
      currentPeriodFptkQ,
      currentPeriodAppQ,
      previousPeriodFptkQ,
      previousPeriodAppQ,
    ]);

    // Convert groupBy results to plain { key: count } maps
    const fptkCountsByCurrentStatus = groupByToMap(fptkGroupedAll, 'currentStatus');
    const applicationCountsByStatus = groupByToMap(appGroupedAll, 'status');
    const fptkPeriodCounts = {
      current: options.periodStart ? groupByToMap(fptkGroupedCurrentPeriod, 'currentStatus') : null,
      previous: options.previousStart ? groupByToMap(fptkGroupedPreviousPeriod, 'currentStatus') : null,
    };
    const appPeriodCounts = {
      current: options.periodStart ? groupByToMap(appGroupedCurrentPeriod, 'status') : null,
      previous: options.previousStart ? groupByToMap(appGroupedPreviousPeriod, 'status') : null,
    };

    // Derive open/closed counts from location-scoped chart data (no extra query needed)
    const statusCounts = {};
    locationFPTKs.forEach((fptk) => {
      const status = (fptk.currentStatus || '').trim();
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    logger.debug('Dashboard: FPTK status distribution:', JSON.stringify(statusCounts));

    const openPositionsCount = locationFPTKs.filter((fptk) => isOpenCurrentStatus(fptk.currentStatus)).length;
    const closedPositionsCount = locationFPTKs.filter((fptk) => isClosedCurrentStatus(fptk.currentStatus)).length;

    logger.debug(`Dashboard: Position counts - Open: ${openPositionsCount}, Closed: ${closedPositionsCount}`);
    logger.debug(
      `Dashboard: locationFPTKs.length: ${locationFPTKs.length}, fptkLocationWhere keys: ${Object.keys(fptkLocationWhere).join(', ')}`
    );

    logger.debug(`Dashboard: Fetched ${locationFPTKs.length} FPTKs for location charts`);

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

    const assignBucketArea = (bucket, fptk) => {
      const resolved = resolveNormalizedArea(fptk);
      if (resolved && !bucket.area) bucket.area = resolved;
    };

    // Calculate Position Status by Location
    const positionStatusByLocationMap = {};
    locationFPTKs.forEach((fptk) => {
      const location = getLocationKey(fptk);
      if (!positionStatusByLocationMap[location]) {
        positionStatusByLocationMap[location] = {
          location,
          area: resolveNormalizedArea(fptk),
          total: 0,
          closed: 0,
          open: 0,
        };
      }
      assignBucketArea(positionStatusByLocationMap[location], fptk);
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
    locationFPTKs.forEach((fptk) => {
      const areaDetail = getLocationKey(fptk);
      const status = getStatus(fptk);
      
      if (!openPositionProgressMap[areaDetail]) {
        openPositionProgressMap[areaDetail] = {
          areaDetail,
          area: resolveNormalizedArea(fptk),
          statusCounts: {},
          total: 0,
        };
      }
      assignBucketArea(openPositionProgressMap[areaDetail], fptk);
      
      if (!openPositionProgressMap[areaDetail].statusCounts[status]) {
        openPositionProgressMap[areaDetail].statusCounts[status] = 0;
      }
      
      openPositionProgressMap[areaDetail].statusCounts[status] += 1;
      openPositionProgressMap[areaDetail].total += 1;
    });

    // Calculate percentages for each area detail
    const totalOpenPositions = locationFPTKs.length;
    Object.values(openPositionProgressMap).forEach((areaData) => {
      areaData.percentage = totalOpenPositions > 0 
        ? Math.round((areaData.total / totalOpenPositions) * 100) 
        : 0;
    });
    const openPositionProgress = Object.values(openPositionProgressMap);

    // Calculate SLA by Location (from FPTK Receive Date, fallback to Request Date)
    const nowDate = new Date();
    const slaByLocationMap = {};
    locationFPTKs.forEach((fptk) => {
      const areaDetail = getLocationKey(fptk);
      const referenceDate = fptk.fptkReceiveDate || fptk.requestDate;
      
      if (!slaByLocationMap[areaDetail]) {
        slaByLocationMap[areaDetail] = {
          areaDetail,
          area: resolveNormalizedArea(fptk),
          buckets: {
            '0-30 Days':     { received: 0, pending: 0 },
            '31-60 Days':    { received: 0, pending: 0 },
            '61-90 Days':    { received: 0, pending: 0 },
            'Above 91 Days': { received: 0, pending: 0 },
          },
          total: 0,
        };
      }
      assignBucketArea(slaByLocationMap[areaDetail], fptk);
      
      if (referenceDate && !isNaN(new Date(referenceDate).getTime())) {
        const requestDateObj = new Date(referenceDate);
        const diffDays = Math.floor(
          (nowDate.getTime() - requestDateObj.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        const isReceived = (fptk.statusFktk || '').toLowerCase() === 'received';
        const fktkKey = isReceived ? 'received' : 'pending';

        if (diffDays <= 30) {
          slaByLocationMap[areaDetail].buckets['0-30 Days'][fktkKey] += 1;
        } else if (diffDays <= 60) {
          slaByLocationMap[areaDetail].buckets['31-60 Days'][fktkKey] += 1;
        } else if (diffDays <= 90) {
          slaByLocationMap[areaDetail].buckets['61-90 Days'][fktkKey] += 1;
        } else {
          slaByLocationMap[areaDetail].buckets['Above 91 Days'][fktkKey] += 1;
        }
        
        slaByLocationMap[areaDetail].total += 1;
      }
    });
    const slaByLocation = Object.values(slaByLocationMap);

    // Build recent activity from already-fetched recentCandidates and recentFPTKs
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

    logger.debug(`Dashboard: Calculated metrics - PositionStatusByLocation: ${positionStatusByLocation.length}, OpenPositionProgress: ${openPositionProgress.length}, SLAByLocation: ${slaByLocation.length}, RecentActivity: ${recentActivity.length}`);

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
      // Aggregated counts for frontend stat cards (no full-dataset pagination needed)
      fptkCountsByCurrentStatus,
      applicationCountsByStatus,
      // Period-filtered counts for WoW comparison (null when period params not provided)
      fptkPeriodCounts,
      appPeriodCounts,
    };

    logger.debug(`Dashboard: Result object keys: ${Object.keys(result).join(', ')}`);

    return result;
  } catch (error) {
    logger.error('Error fetching dashboard stats:', error);
    throw error;
  }
}

module.exports = {
  getDashboardStats,
  buildAreaFilterCondition,
  buildAreaDetailsFilterCondition,
  buildFptkDateCondition,
  parseAreaDetailsParam,
  resolveNormalizedArea,
  getLocationKey,
};

