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

// =============================================================================
// SQL-BASED CHART AGGREGATION
// Replaces the old locationFPTKs findMany + JS forEach loops.
// Requires the indonesia_business_days PostgreSQL function created by migration
// 20260702030000_add_indonesia_business_days, and data in indonesia_holidays
// seeded via scripts/seed-indonesia-holidays.js.
// =============================================================================

/**
 * Build a SQL WHERE fragment that mirrors buildDashboardScope's fptkLocationWhere
 * (role scope + UI filters + optional period date window).
 * Returns { whereClause: string, params: any[] } for use with $queryRawUnsafe.
 *
 * All values are positional ($1, $2, …) — no direct interpolation of user data.
 */
function buildFptkLocationSqlFilter(user, options) {
  const params = [];
  const conditions = [];

  /** Push a value to params and return its $N placeholder. */
  const addParam = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  /**
   * Convert a Prisma inFilter value (string | { in: string[] }) to a SQL condition.
   * Returns null if the value is falsy.
   */
  const addInCondition = (valueOrFilter, columnExpr) => {
    if (!valueOrFilter) return null;
    if (typeof valueOrFilter === 'string') {
      return `${columnExpr} = ${addParam(valueOrFilter)}`;
    }
    if (Array.isArray(valueOrFilter.in) && valueOrFilter.in.length > 0) {
      return `${columnExpr} = ANY(${addParam(valueOrFilter.in)}::text[])`;
    }
    return null;
  };

  // --- Role-based scope (mirrors buildDashboardScope) ---
  const UNRESTRICTED_ROLES = new Set(['SUPER_ADMIN', 'TA_HO', 'CHRO']);
  if (user && !UNRESTRICTED_ROLES.has(user.role)) {
    const role = user.role;

    if (role === 'HIRING_MANAGER') {
      const firstName = String(user.firstName || '').trim();
      const lastName  = String(user.lastName  || '').trim();
      const email     = String(user.email     || '').trim();
      const fullName  = [firstName, lastName].filter(Boolean).join(' ').trim();
      const values    = [...new Set([firstName, fullName, email].filter(Boolean))];
      if (values.length > 0) {
        const hmConds = values.map(
          (v) => `LOWER(COALESCE(f."hiringManager", '')) = LOWER(${addParam(v)})`
        );
        conditions.push(`(${hmConds.join(' OR ')})`);
      } else {
        conditions.push('FALSE');
      }
    } else if (isDepartmentHeadRole(role)) {
      const hodFptk = buildHodFptkFilterFromUser(user);
      if (!hodFptk) {
        conditions.push('FALSE');
      } else {
        const divCond = addInCondition(hodFptk.division, 'f."division"');
        if (divCond) conditions.push(divCond);
        if (hodFptk.section) {
          const secCond = addInCondition(hodFptk.section, 'f."section"');
          if (secCond) conditions.push(secCond);
        }
      }
    } else if (role === 'HRBP' || role === 'TA_SITE') {
      const hrbpFptk = buildHrbpFptkFilterFromUser(user);
      if (!hrbpFptk) {
        conditions.push('FALSE');
      } else {
        const ptCond     = addInCondition(hrbpFptk.pt,         'f."pt"');
        const areaCond   = addInCondition(hrbpFptk.area,       'f."area"');
        const detailCond = addInCondition(hrbpFptk.areaDetail, 'f."areaDetail"');
        if (ptCond)     conditions.push(ptCond);
        if (areaCond)   conditions.push(areaCond);
        if (detailCond) conditions.push(detailCond);
      }
    }
  }

  // --- Priority filter ---
  if (options.priority && options.priority !== 'ALL') {
    conditions.push(`f."priority" = ${addParam(options.priority)}`);
  }

  // --- Position status filter ---
  if (options.positionStatus === 'OPEN') {
    conditions.push(
      `(f."currentStatus" IS NULL OR LOWER(TRIM(f."currentStatus")) IN ('open','pending fktk','re-open','reopen'))`
    );
  } else if (options.positionStatus === 'CLOSED') {
    conditions.push(
      `LOWER(TRIM(COALESCE(f."currentStatus",''))) IN ('close','internal movement')`
    );
  }

  // --- Area filter (HO / Site with legacy location-field fallback) ---
  const areaTarget = (options.area || '').trim().toLowerCase();
  if (areaTarget && areaTarget !== 'all') {
    if (areaTarget === 'ho') {
      conditions.push(
        `(LOWER(TRIM(f."area")) = 'ho' OR (COALESCE(TRIM(f."area"),'') = '' AND LOWER(TRIM(COALESCE(f."location",''))) = 'head office'))`
      );
    } else if (areaTarget === 'site') {
      conditions.push(
        `(LOWER(TRIM(f."area")) = 'site' OR (COALESCE(TRIM(f."area"),'') = '' AND LOWER(TRIM(COALESCE(f."location",''))) = 'site'))`
      );
    }
  }

  // --- areaDetails filter ---
  const parsedDetails = parseAreaDetailsParam(options.areaDetails);
  if (parsedDetails !== null) {
    if (parsedDetails.length === 0) {
      conditions.push('FALSE');
    } else {
      conditions.push(`f."areaDetail" = ANY(${addParam(parsedDetails)}::text[])`);
    }
  }

  // --- Period date window (mirrors fptkLocationWhere) ---
  if (options.periodStart && options.periodEnd) {
    const ps = new Date(options.periodStart);
    const pe = new Date(options.periodEnd);
    if (!isNaN(ps.getTime()) && !isNaN(pe.getTime())) {
      // Reuse same param indices for both columns
      const psIdx = params.length + 1;
      params.push(ps);
      const peIdx = params.length + 1;
      params.push(pe);
      conditions.push(
        `(f."updatedAt" BETWEEN $${psIdx} AND $${peIdx} OR f."createdAt" BETWEEN $${psIdx} AND $${peIdx})`
      );
    }
  }

  return {
    whereClause: conditions.length > 0 ? conditions.join(' AND ') : 'TRUE',
    params,
  };
}

/** Resolved area label used in every SQL chart query. */
const AREA_EXPR = `
  CASE
    WHEN TRIM(COALESCE(f."area",'')) <> '' THEN TRIM(f."area")
    WHEN LOWER(TRIM(COALESCE(f."location",''))) = 'head office' THEN 'HO'
    WHEN LOWER(TRIM(COALESCE(f."location",''))) = 'site'        THEN 'Site'
    ELSE ''
  END`.trim();

/**
 * SLA-by-location chart: returns the same shape as the old JS loop.
 * Uses the indonesia_business_days() PostgreSQL function.
 * Falls back to empty array if the function has not been installed yet.
 */
async function getSlaByLocationSql(user, options) {
  const { whereClause, params } = buildFptkLocationSqlFilter(user, options);

  const sql = `
    WITH fptk_sla AS (
      SELECT
        COALESCE(NULLIF(TRIM(f."areaDetail"),''),'Unassigned') AS area_detail,
        ${AREA_EXPR}                                            AS area,
        LOWER(TRIM(COALESCE(f."statusFktk",'')))               AS status_fktk,
        COALESCE(f."fptkReceiveDate", f."requestDate", f."createdAt")::date AS sla_start,
        CASE
          WHEN LOWER(TRIM(COALESCE(f."currentStatus",''))) IN ('close','cancel','internal movement')
          THEN COALESCE(f."closedAt", NOW())::date
          ELSE NOW()::date
        END AS sla_end
      FROM fptk f
      WHERE ${whereClause}
    ),
    fptk_with_days AS (
      SELECT
        area_detail,
        area,
        status_fktk,
        indonesia_business_days(sla_start, sla_end) AS working_days
      FROM fptk_sla
      WHERE sla_start IS NOT NULL
    )
    SELECT
      area_detail,
      area,
      CASE
        WHEN working_days <= 30 THEN '0-30 Days'
        WHEN working_days <= 60 THEN '31-60 Days'
        WHEN working_days <= 90 THEN '61-90 Days'
        ELSE 'Above 91 Days'
      END                                                             AS sla_bucket,
      SUM(CASE WHEN status_fktk = 'received' THEN 1 ELSE 0 END)::int AS received_count,
      SUM(CASE WHEN status_fktk <> 'received' THEN 1 ELSE 0 END)::int AS pending_count,
      COUNT(*)::int                                                   AS total
    FROM fptk_with_days
    GROUP BY area_detail, area, sla_bucket
    ORDER BY area_detail, sla_bucket
  `;

  const rows = await prisma.$queryRawUnsafe(sql, ...params);

  const SLA_BUCKETS = ['0-30 Days', '31-60 Days', '61-90 Days', 'Above 91 Days'];
  const slaMap = {};

  rows.forEach((row) => {
    if (!slaMap[row.area_detail]) {
      slaMap[row.area_detail] = {
        areaDetail: row.area_detail,
        area: row.area || '',
        buckets: Object.fromEntries(SLA_BUCKETS.map((b) => [b, { received: 0, pending: 0 }])),
        total: 0,
      };
    }
    const entry = slaMap[row.area_detail];
    if (!entry.area && row.area) entry.area = row.area;
    if (row.sla_bucket && entry.buckets[row.sla_bucket]) {
      entry.buckets[row.sla_bucket].received = Number(row.received_count);
      entry.buckets[row.sla_bucket].pending  = Number(row.pending_count);
      entry.total += Number(row.total);
    }
  });

  return Object.values(slaMap);
}

/**
 * Position-status-by-location chart.
 * open  = currentStatus IS NULL or in the open-status list (mirrors isOpenCurrentStatus)
 * closed = everything else (mirrors the isClosed = !isOpenCurrentStatus check)
 */
async function getPositionStatusByLocationSql(user, options) {
  const { whereClause, params } = buildFptkLocationSqlFilter(user, options);

  const sql = `
    WITH base AS (
      SELECT
        COALESCE(NULLIF(TRIM(f."areaDetail"),''),'Unassigned') AS location,
        ${AREA_EXPR}                                            AS area,
        f."currentStatus"
      FROM fptk f
      WHERE ${whereClause}
    )
    SELECT
      location,
      area,
      COUNT(*)::int AS total,
      SUM(CASE
        WHEN "currentStatus" IS NULL
          OR LOWER(TRIM("currentStatus")) IN ('open','pending fktk','re-open','reopen')
        THEN 1 ELSE 0
      END)::int AS open,
      SUM(CASE
        WHEN "currentStatus" IS NOT NULL
         AND LOWER(TRIM("currentStatus")) NOT IN ('open','pending fktk','re-open','reopen')
        THEN 1 ELSE 0
      END)::int AS closed
    FROM base
    GROUP BY location, area
    ORDER BY location
  `;

  const rows = await prisma.$queryRawUnsafe(sql, ...params);
  return rows.map((r) => ({
    location: r.location,
    area:     r.area || '',
    total:    Number(r.total),
    open:     Number(r.open),
    closed:   Number(r.closed),
  }));
}

/**
 * Open-position-progress chart: count of each FPTK status per area detail.
 * Mirrors the getStatus() helper + percentage = areaTotal / grandTotal * 100.
 */
async function getOpenPositionProgressSql(user, options) {
  const { whereClause, params } = buildFptkLocationSqlFilter(user, options);

  const sql = `
    WITH base AS (
      SELECT
        COALESCE(NULLIF(TRIM(f."areaDetail"),''),'Unassigned') AS area_detail,
        ${AREA_EXPR}                                            AS area,
        CASE
          WHEN f."currentStatus" IS NOT NULL AND TRIM(f."currentStatus") <> ''
            THEN f."currentStatus"
          WHEN f."status"::text = 'DRAFT'            THEN 'Draft'
          WHEN f."status"::text = 'APPROVED'         THEN 'Approved'
          WHEN f."status"::text = 'OPEN'             THEN 'Open'
          WHEN f."status"::text = 'PARTIALLY_FILLED' THEN 'Partially Filled'
          WHEN f."status"::text = 'FILLED'           THEN 'Filled'
          WHEN f."status"::text = 'CANCELLED'        THEN 'Cancelled'
          WHEN f."status"::text = 'EXPIRED'          THEN 'Expired'
          ELSE COALESCE(NULLIF(TRIM(f."status"::text),''), 'Raise FPTK')
        END AS status
      FROM fptk f
      WHERE ${whereClause}
    )
    SELECT
      area_detail,
      area,
      status,
      COUNT(*)::int                     AS count,
      SUM(COUNT(*)) OVER ()::int        AS grand_total
    FROM base
    GROUP BY area_detail, area, status
    ORDER BY area_detail, status
  `;

  const rows = await prisma.$queryRawUnsafe(sql, ...params);

  const progressMap = {};
  const grandTotal = rows.length > 0 ? Number(rows[0].grand_total) : 0;

  rows.forEach((row) => {
    if (!progressMap[row.area_detail]) {
      progressMap[row.area_detail] = {
        areaDetail:   row.area_detail,
        area:         row.area || '',
        statusCounts: {},
        total:        0,
      };
    }
    const entry = progressMap[row.area_detail];
    if (!entry.area && row.area) entry.area = row.area;
    entry.statusCounts[row.status] = (entry.statusCounts[row.status] || 0) + Number(row.count);
    entry.total += Number(row.count);
  });

  return Object.values(progressMap).map((item) => ({
    ...item,
    percentage: grandTotal > 0 ? Math.round((item.total / grandTotal) * 100) : 0,
  }));
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

    // Single parallel round-trip for scalar counts + groupBy queries.
    // Location chart data (SLA, position status, open progress) is fetched in a
    // second parallel batch using SQL aggregation — no 10 000-row findMany needed.
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

    // Derive open/closed counts from the all-time fptkCountsByCurrentStatus groupBy
    // (previously computed from locationFPTKs; frontend already uses fptkCountsByCurrentStatus
    //  for its own stat cards so this is consistent).
    const openPositionsCount = Object.entries(fptkCountsByCurrentStatus)
      .filter(([s]) => isOpenCurrentStatus(s))
      .reduce((sum, [, c]) => sum + c, 0);
    const closedPositionsCount = Object.entries(fptkCountsByCurrentStatus)
      .filter(([s]) => isClosedCurrentStatus(s))
      .reduce((sum, [, c]) => sum + c, 0);

    logger.debug(`Dashboard: Position counts from groupBy — Open: ${openPositionsCount}, Closed: ${closedPositionsCount}`);

    // SQL-based chart aggregation (runs as a second parallel batch after the scalar counts).
    // getSlaByLocationSql uses the indonesia_business_days PostgreSQL function.
    // If the function is not yet installed (migration not run), we log a warning
    // and return an empty SLA array rather than crashing the entire dashboard.
    let positionStatusByLocation = [];
    let openPositionProgress     = [];
    let slaByLocation            = [];

    try {
      [positionStatusByLocation, openPositionProgress, slaByLocation] = await Promise.all([
        getPositionStatusByLocationSql(user, options),
        getOpenPositionProgressSql(user, options),
        getSlaByLocationSql(user, options),
      ]);
      logger.debug(
        `Dashboard: SQL charts — positionStatus: ${positionStatusByLocation.length}, ` +
        `openProgress: ${openPositionProgress.length}, sla: ${slaByLocation.length}`
      );
    } catch (sqlErr) {
      logger.error(
        'Dashboard: SQL chart aggregation failed — charts will be empty. ' +
        'Run migration 20260702030000 and seed-indonesia-holidays.js to enable SQL SLA. ' +
        `Error: ${sqlErr.message}`
      );
    }

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

