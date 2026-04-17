/**
 * HRBP users store multiple PT / Area / Area Detail values in User.pt, User.area, User.areaDetail
 * as a single string joined by SEP (legacy single values are unchanged).
 */

const SEP = '||';

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
  const areas = parseMulti(user?.area);
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

function serializeHrbpFields({ pt, area, areaDetail }) {
  return {
    pt: packField(pt),
    area: packField(area),
    areaDetail: packField(areaDetail),
  };
}

module.exports = {
  SEP,
  parseMulti,
  buildHrbpFptkFilterFromUser,
  serializeHrbpFields,
};
