const prisma = require('../config/database');
const logger = require('../utils/logger');
const { applyExcludeHiredCandidates } = require('../utils/candidateApplicationLock');
const { buildHrbpFptkFilterFromUser, buildHrbpApplicationFptkFilterFromUser } = require('../utils/hrbpScope');
const { isDepartmentHeadRole, buildHodFptkFilterFromUser, buildHodApplicationScopeFromUser, buildHodCandidateScopeFromUser } = require('../utils/hodScope');
const { withActiveCandidateOnApplication } = require('../utils/candidateVisibility');
const { getPositionSlaBucket, getPositionSlaWorkingDays } = require('../utils/positionSla');

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

const OPEN_FPTK_STATUS_CONDITION = {
  OR: [
    { currentStatus: null },
    { currentStatus: { equals: 'Open', mode: 'insensitive' } },
    { currentStatus: { equals: 'Pending FKTK', mode: 'insensitive' } },
    { currentStatus: { equals: 'Re-Open', mode: 'insensitive' } },
    { currentStatus: { equals: 'Reopen', mode: 'insensitive' } },
  ],
};

const DETAIL_APPLICATION_STATUSES = {
  interview: ['INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'TECHNICAL_TEST'],
  offering: ['OFFER_PROPOSED', 'OFFER_APPROVED', 'OFFER_ACCEPTED'],
  mcu: ['MEDICAL_CHECKUP_COMPLETED'],
  offer_rejected: ['OFFER_REJECTED'],
  rejected: ['REJECTED'],
  withdrawn: ['WITHDRAWN'],
};

/**
 * Build Prisma WHERE scopes shared by dashboard stats and detail lists.
 */
function buildDashboardScope(user = null, options = {}) {
  const fptkWhere = {};
  const applicationWhere = {};
  const candidateWhere = { isDeleted: false };

  if (user) {
    const userRole = user.role;

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
    } else if (isDepartmentHeadRole(userRole)) {
      const hodFptk = buildHodFptkFilterFromUser(user);
      const hodApplications = buildHodApplicationScopeFromUser(user);
      const hodCandidates = buildHodCandidateScopeFromUser(user);
      if (hodFptk) {
        Object.assign(fptkWhere, hodFptk);
      } else {
        fptkWhere.id = '00000000-0000-0000-0000-000000000000';
      }
      if (hodApplications) {
        Object.assign(applicationWhere, hodApplications);
      } else {
        applicationWhere.id = '00000000-0000-0000-0000-000000000000';
      }
      if (hodCandidates) {
        Object.assign(candidateWhere, hodCandidates);
      } else {
        candidateWhere.id = '00000000-0000-0000-0000-000000000000';
      }
    } else if (userRole === 'HRBP' || userRole === 'TA_SITE') {
      const hrbpFptk = buildHrbpFptkFilterFromUser(user);
      const hrbpApplications = buildHrbpApplicationFptkFilterFromUser(user);
      if (hrbpFptk) {
        Object.assign(fptkWhere, hrbpFptk);
      } else {
        fptkWhere.id = '00000000-0000-0000-0000-000000000000';
      }
      if (hrbpApplications) {
        Object.assign(applicationWhere, hrbpApplications);
        candidateWhere.applications = {
          some: hrbpApplications,
        };
      } else {
        applicationWhere.id = '00000000-0000-0000-0000-000000000000';
        candidateWhere.id = '00000000-0000-0000-0000-000000000000';
      }
    }
  }

  if (options.priority && options.priority !== 'ALL') {
    fptkWhere.priority = options.priority;
    if (applicationWhere.fptk) {
      applicationWhere.fptk = { AND: [applicationWhere.fptk, { priority: options.priority }] };
    } else {
      addConditionToWhere(applicationWhere, { fptk: { priority: options.priority } });
    }
  }
  if (options.positionStatus === 'OPEN') {
    addConditionToWhere(fptkWhere, OPEN_FPTK_STATUS_CONDITION);
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

  applyExcludeHiredCandidates(candidateWhere);

  const fptkLocationWhere = cloneWhere(fptkWhere);
  const locationPeriodCondition = buildFptkDateCondition(options.periodStart, options.periodEnd);
  if (locationPeriodCondition) {
    addConditionToWhere(fptkLocationWhere, locationPeriodCondition);
  }

  let fptkPeriodWhere = null;
  let appPeriodWhere = null;
  if (options.periodStart && options.periodEnd) {
    const fptkDateCondition = buildFptkDateCondition(options.periodStart, options.periodEnd);
    if (fptkDateCondition) {
      fptkPeriodWhere = cloneWhere(fptkWhere);
      addConditionToWhere(fptkPeriodWhere, fptkDateCondition);

      const ps = new Date(options.periodStart);
      const pe = new Date(options.periodEnd);
      appPeriodWhere = cloneWhere(applicationWhere);
      addConditionToWhere(appPeriodWhere, {
        OR: [
          { updatedAt: { gte: ps, lte: pe } },
          { appliedAt: { gte: ps, lte: pe } },
        ],
      });
    }
  }

  return {
    fptkWhere,
    applicationWhere,
    candidateWhere,
    fptkLocationWhere,
    fptkPeriodWhere,
    appPeriodWhere,
  };
}

function formatApplicationDetailItem(application) {
  const candidateName =
    `${application?.candidate?.user?.firstName || ''} ${application?.candidate?.user?.lastName || ''}`.trim() ||
    'Unknown Candidate';
  const positionTitle =
    application?.fptk?.positionTitle || application?.fptk?.position || 'Unknown Position';
  const department = application?.fptk?.department || application?.candidate?.user?.division || 'N/A';
  return {
    id: application?.fptkId || application?.id,
    kind: application?.fptkId ? 'fptk' : 'application',
    title: candidateName,
    subtitle: `${positionTitle} • ${department}`,
    meta: (application?.status || '').toString().trim().replace(/_/g, ' ') || 'Unknown',
  };
}

function formatFptkDetailItem(fptk) {
  return {
    id: fptk?.id,
    kind: 'fptk',
    title: fptk?.positionTitle || fptk?.position || 'Unknown Position',
    subtitle: `${fptk?.department || 'N/A'} • ${fptk?.areaDetail || fptk?.area || fptk?.location || 'N/A'}`,
    meta: fptk?.currentStatus || fptk?.status || 'N/A',
  };
}

function formatSlaFptkDetailItem(fptk, nowDate = new Date()) {
  const agingDays = getPositionSlaWorkingDays(fptk, nowDate);
  const receivedRaw = fptk?.fptkReceiveDate || fptk?.requestDate;
  const receivedLabel = receivedRaw
    ? new Date(receivedRaw).toLocaleDateString('id-ID')
    : '-';
  return {
    id: fptk?.id,
    kind: 'fptk',
    title: fptk?.positionTitle || fptk?.position || 'Unknown Position',
    subtitle: `${fptk?.department || 'N/A'} • ${fptk?.areaDetail || fptk?.area || 'N/A'}`,
    agingDays,
    meta: `FKTK: ${fptk?.statusFktk || 'Pending'} • FPTK Received: ${receivedLabel}`,
  };
}

function formatCandidateDetailItem(candidate) {
  return {
    id: candidate?.id,
    kind: 'candidate',
    title: `${candidate?.user?.firstName || ''} ${candidate?.user?.lastName || ''}`.trim() || 'Unknown',
    subtitle: candidate?.user?.email || 'No email',
    meta: candidate?._count?.applications
      ? `${candidate._count.applications} application(s)`
      : 'No applications',
  };
}

const DASHBOARD_DETAIL_LIMIT = 2000;

/**
 * List rows for dashboard card / location drill-down modals (same filters as stats).
 */
async function getDashboardDetailList(user = null, options = {}) {
  const scope = buildDashboardScope(user, options);
  const detail = (options.detail || '').trim().toLowerCase();
  const usePeriod = options.usePeriod === 'true' || options.usePeriod === true;

  if (detail === 'candidates') {
    const rows = await prisma.candidate.findMany({
      where: scope.candidateWhere,
      take: DASHBOARD_DETAIL_LIMIT,
      orderBy: [{ user: { firstName: 'asc' } }, { user: { lastName: 'asc' } }],
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: { applications: true },
        },
      },
    });
    return { items: rows.map(formatCandidateDetailItem) };
  }

  const applicationStatuses = DETAIL_APPLICATION_STATUSES[detail];
  if (applicationStatuses) {
    const baseWhere = usePeriod && scope.appPeriodWhere ? scope.appPeriodWhere : scope.applicationWhere;
    const where = cloneWhere(baseWhere);
    addConditionToWhere(where, { status: { in: applicationStatuses } });
    const rows = await prisma.application.findMany({
      where: withActiveCandidateOnApplication(where),
      take: DASHBOARD_DETAIL_LIMIT,
      orderBy: { updatedAt: 'desc' },
      include: {
        candidate: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                division: true,
              },
            },
          },
        },
        fptk: {
          select: {
            id: true,
            positionTitle: true,
            position: true,
            department: true,
          },
        },
      },
    });
    return { items: rows.map(formatApplicationDetailItem) };
  }

  if (detail === 'hired' || detail === 'open_positions') {
    const baseWhere = usePeriod && scope.fptkPeriodWhere ? scope.fptkPeriodWhere : scope.fptkWhere;
    const where = cloneWhere(baseWhere);
    if (detail === 'hired') {
      addConditionToWhere(where, { currentStatus: { equals: 'close', mode: 'insensitive' } });
    } else {
      addConditionToWhere(where, OPEN_FPTK_STATUS_CONDITION);
    }
    const rows = await prisma.fPTK.findMany({
      where,
      take: DASHBOARD_DETAIL_LIMIT,
      orderBy: { positionTitle: 'asc' },
      select: {
        id: true,
        positionTitle: true,
        position: true,
        department: true,
        areaDetail: true,
        area: true,
        location: true,
        currentStatus: true,
        status: true,
      },
    });
    return { items: rows.map(formatFptkDetailItem) };
  }

  if (detail === 'sla') {
    const areaDetail = (options.areaDetail || '').trim();
    const slaBucket = (options.slaBucket || '').trim();
    const where = cloneWhere(scope.fptkLocationWhere);
    if (areaDetail) {
      addConditionToWhere(where, { areaDetail });
    }
    const rows = await prisma.fPTK.findMany({
      where,
      take: DASHBOARD_DETAIL_LIMIT,
      select: {
        id: true,
        positionTitle: true,
        position: true,
        department: true,
        areaDetail: true,
        area: true,
        fptkReceiveDate: true,
        requestDate: true,
        createdAt: true,
        currentStatus: true,
        closedAt: true,
        statusFktk: true,
      },
    });
    const nowDate = new Date();
    const items = rows
      .filter((fptk) => !slaBucket || getPositionSlaBucket(fptk, nowDate) === slaBucket)
      .map((fptk) => formatSlaFptkDetailItem(fptk, nowDate))
      .sort((a, b) => (b.agingDays ?? 0) - (a.agingDays ?? 0));
    return { items };
  }

  return { items: [] };
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
    const scope = buildDashboardScope(user, options);
    const {
      fptkWhere,
      applicationWhere,
      candidateWhere,
      fptkLocationWhere,
      fptkPeriodWhere,
      appPeriodWhere,
    } = scope;

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

    const buildPeriodGroupBys = () => {
      if (!fptkPeriodWhere || !appPeriodWhere) {
        return [Promise.resolve([]), Promise.resolve([])];
      }
      return [
        prisma.fPTK.groupBy({ by: ['currentStatus'], where: fptkPeriodWhere, _count: { _all: true } }),
        prisma.application.groupBy({ by: ['status'], where: appPeriodWhere, _count: { _all: true } }),
      ];
    };
    const [currentPeriodFptkQ, currentPeriodAppQ] = buildPeriodGroupBys();
    const [previousPeriodFptkQ, previousPeriodAppQ] = options.previousStart && options.previousEnd && fptkPeriodWhere
      ? (() => {
          const prevFptkWhere = cloneWhere(fptkWhere);
          addConditionToWhere(prevFptkWhere, buildFptkDateCondition(options.previousStart, options.previousEnd));
          const ps = new Date(options.previousStart);
          const pe = new Date(options.previousEnd);
          const prevAppWhere = cloneWhere(applicationWhere);
          addConditionToWhere(prevAppWhere, {
            OR: [
              { updatedAt: { gte: ps, lte: pe } },
              { appliedAt: { gte: ps, lte: pe } },
            ],
          });
          return [
            prisma.fPTK.groupBy({ by: ['currentStatus'], where: prevFptkWhere, _count: { _all: true } }),
            prisma.application.groupBy({ by: ['status'], where: prevAppWhere, _count: { _all: true } }),
          ];
        })()
      : [Promise.resolve([]), Promise.resolve([])];

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
          createdAt: true,
          closedAt: true,
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

    // SLA by Location: Indonesia working days from FPTK Receive Date (same as Summary by Position)
    const nowDate = new Date();
    const slaByLocationMap = {};
    locationFPTKs.forEach((fptk) => {
      const areaDetail = getLocationKey(fptk);

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

      const bucket = getPositionSlaBucket(fptk, nowDate);
      if (bucket && bucket !== '-' && slaByLocationMap[areaDetail].buckets[bucket]) {
        const isReceived = (fptk.statusFktk || '').toLowerCase() === 'received';
        const fktkKey = isReceived ? 'received' : 'pending';
        slaByLocationMap[areaDetail].buckets[bucket][fktkKey] += 1;
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
  getDashboardDetailList,
  buildDashboardScope,
  buildAreaFilterCondition,
  buildAreaDetailsFilterCondition,
  buildFptkDateCondition,
  parseAreaDetailsParam,
  resolveNormalizedArea,
  getLocationKey,
};

