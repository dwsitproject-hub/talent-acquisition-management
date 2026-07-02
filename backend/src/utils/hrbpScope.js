/**
 * HRBP users store multiple PT / Area / Area Detail values in User.pt, User.area, User.areaDetail
 * as a single string joined by SEP (legacy single values are unchanged).
 */

const SEP = '||';
const TA_SITE_FIXED_AREA = 'Site';

function isTaSiteRole(role) {
  return role === 'TA_SITE';
}

function resolveAreasForUser(user) {
  if (isTaSiteRole(user?.role)) {
    return [TA_SITE_FIXED_AREA];
  }
  return parseMulti(user?.area);
}

function parseMulti(value) {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  const s = String(value).trim();
  if (!s) return [];
  return s.split(SEP).map((part) => part.trim()).filter(Boolean);
}

function hasHrbpTriple(pts, areas, details) {
  return pts.length > 0 && areas.length > 0 && details.length > 0;
}

/**
 * Prisma where fragment for FPTK rows scoped to an HRBP user's PT/Area/Area Detail lists.
 * @returns {object|null} flat { pt, area, areaDetail } or null if not scoped
 */
function buildHrbpFptkFilterFromUser(user) {
  const pts = parseMulti(user?.pt);
  const areas = resolveAreasForUser(user);
  const details = parseMulti(user?.areaDetail);
  if (!hasHrbpTriple(pts, areas, details)) {
    return null;
  }
  return {
    pt: pts.length === 1 ? pts[0] : { in: pts },
    area: areas.length === 1 ? areas[0] : { in: areas },
    areaDetail: details.length === 1 ? details[0] : { in: details },
  };
}

function packField(v) {
  if (v === undefined || v === null) return null;
  if (Array.isArray(v)) {
    const parts = v.map((x) => String(x).trim()).filter(Boolean);
    return parts.length ? parts.join(SEP) : null;
  }
  const s = String(v).trim();
  return s || null;
}

function serializeHrbpFields({ pt, area, areaDetail, role }) {
  const resolvedArea = isTaSiteRole(role) ? TA_SITE_FIXED_AREA : area;
  return {
    pt: packField(pt),
    area: packField(resolvedArea),
    areaDetail: packField(areaDetail),
  };
}

/** Roles that may only store a single PT / Area / Area Detail value. */
const SINGLE_PT_AREA_DETAIL_ROLES = new Set(['CHRO', 'TA_HO']);

function roleAllowsMultiPtAreaDetail(mappedRole) {
  if (!mappedRole) return false;
  return !SINGLE_PT_AREA_DETAIL_ROLES.has(mappedRole);
}

/**
 * Enforce PT/Area scope rules on user create/update.
 * - Management (CHRO) and TA_HO: single values only.
 * - All other scoped roles: multiple values allowed, but only SUPER_ADMIN may assign them.
 */
function validateUserPtAreaAssignment({ pt, area, areaDetail, role, requesterRole }) {
  const mappedRole = role;
  const pts = parseMulti(pt);
  const areas = parseMulti(area);
  const details = parseMulti(areaDetail);

  if (SINGLE_PT_AREA_DETAIL_ROLES.has(mappedRole)) {
    if (pts.length > 1 || areas.length > 1 || details.length > 1) {
      const err = new Error('Management and TA HO users can only have one PT, Area, and Area Detail');
      err.statusCode = 400;
      throw err;
    }
    return;
  }

  if (!roleAllowsMultiPtAreaDetail(mappedRole)) {
    return;
  }

  const hasMultiple = pts.length > 1 || areas.length > 1 || details.length > 1;
  if (hasMultiple && requesterRole !== 'SUPER_ADMIN') {
    const err = new Error('Only SUPER_ADMIN can assign multiple PT and Area Detail values');
    err.statusCode = 403;
    throw err;
  }
}

function inFilter(values) {
  if (!values || values.length === 0) return undefined;
  return values.length === 1 ? values[0] : { in: values };
}

/**
 * Prisma where fragment for applications/candidates scoped to HRBP or TA_SITE user.
 * @returns {object|null} { fptk: { pt, area, areaDetail } } or null
 */
function buildHrbpApplicationFptkFilterFromUser(user) {
  const filter = buildHrbpFptkFilterFromUser(user);
  if (!filter) return null;
  return { fptk: filter };
}

module.exports = {
  SEP,
  TA_SITE_FIXED_AREA,
  SINGLE_PT_AREA_DETAIL_ROLES,
  isTaSiteRole,
  parseMulti,
  inFilter,
  packField,
  roleAllowsMultiPtAreaDetail,
  validateUserPtAreaAssignment,
  buildHrbpFptkFilterFromUser,
  buildHrbpApplicationFptkFilterFromUser,
  serializeHrbpFields,
};
