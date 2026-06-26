const logger = require('../utils/logger');
const candidateService = require('./candidateService');
const masterDivisionService = require('./masterDivisionService');
const masterOfficeLocationService = require('./masterOfficeLocationService');
const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const { parseMulti, serializeHrbpFields, TA_SITE_FIXED_AREA } = require('../utils/hrbpScope');
const { serializeHodFields } = require('../utils/hodScope');

function splitName(fullName) {
  const name = String(fullName || '').trim();
  if (!name) return { firstName: '', lastName: '' };
  const parts = name.split(/\s+/);
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ');
  return { firstName, lastName };
}

function toStringValue(v) {
  const s = String(v ?? '').trim();
  return s;
}

async function importCandidates(rows) {
  const result = { created: 0, failed: 0, errors: [] };

  for (let i = 0; i < rows.length; i += 1) {
    const rowNum = i + 2; // header is row 1
    const row = rows[i] || {};

    const name = toStringValue(row['name']);
    const email = toStringValue(row['email']).toLowerCase();
    const phoneNumber = toStringValue(row['phone number']);
    const positionAppliedFor = toStringValue(row['position applied for']);
    const division = toStringValue(row['division']);

    if (!email) {
      result.failed += 1;
      result.errors.push({ row: rowNum, message: 'Missing Email' });
      continue;
    }

    const { firstName, lastName } = splitName(name);
    if (!firstName) {
      result.failed += 1;
      result.errors.push({ row: rowNum, message: 'Missing Name' });
      continue;
    }

    try {
      await candidateService.createCandidate({
        email,
        firstName,
        lastName,
        phoneNumber: phoneNumber || null,
        division: division || null,
        divisionList: division ? [division] : [],
        positionAppliedFor: positionAppliedFor ? [positionAppliedFor] : [],
        position: positionAppliedFor || null,
      });
      result.created += 1;
    } catch (e) {
      result.failed += 1;
      result.errors.push({ row: rowNum, email, message: e.message || 'Failed to create candidate' });
      logger.warn(`Bulk import candidate failed row ${rowNum}: ${e.message}`);
    }
  }

  return result;
}

async function importMasterDivisions(rows) {
  const result = { created: 0, failed: 0, errors: [] };

  for (let i = 0; i < rows.length; i += 1) {
    const rowNum = i + 2;
    const row = rows[i] || {};

    const divisionName = toStringValue(row['division name']);
    const sectionName = toStringValue(row['section name']);
    const headOfDivisionName = toStringValue(row['head of division name']);

    if (!divisionName || !sectionName || !headOfDivisionName) {
      result.failed += 1;
      result.errors.push({
        row: rowNum,
        message: 'Missing required fields (Division Name, Section Name, Head of Division Name)',
      });
      continue;
    }

    try {
      await masterDivisionService.createDivision({ divisionName, sectionName, headOfDivisionName });
      result.created += 1;
    } catch (e) {
      result.failed += 1;
      result.errors.push({ row: rowNum, message: e.message || 'Failed to create division' });
      logger.warn(`Bulk import division failed row ${rowNum}: ${e.message}`);
    }
  }

  return result;
}

async function importMasterOfficeLocations(rows) {
  const result = { created: 0, failed: 0, errors: [] };

  for (let i = 0; i < rows.length; i += 1) {
    const rowNum = i + 2;
    const row = rows[i] || {};

    const pt = toStringValue(row['pt']);
    const area = toStringValue(row['area']);
    const areaDetail = toStringValue(row['area detail']);

    if (!pt || !area || !areaDetail) {
      result.failed += 1;
      result.errors.push({ row: rowNum, message: 'Missing required fields (PT, Area, Area Detail)' });
      continue;
    }

    try {
      await masterOfficeLocationService.createOfficeLocation({ pt, area, areaDetail });
      result.created += 1;
    } catch (e) {
      result.failed += 1;
      result.errors.push({ row: rowNum, message: e.message || 'Failed to create office location' });
      logger.warn(`Bulk import office location failed row ${rowNum}: ${e.message}`);
    }
  }

  return result;
}

function mapRoleToEnum(role) {
  if (!role) return role;
  const roleMap = {
    SUPER_ADMIN: 'SUPER_ADMIN',
    Management: 'CHRO',
    CHRO: 'CHRO',
    'Head of Division': 'DEPARTMENT_HEAD',
    DEPARTMENT_HEAD: 'DEPARTMENT_HEAD',
    HRBP: 'HRBP',
    TA_SITE: 'TA_SITE',
    'TA Site': 'TA_SITE',
    TA_HO: 'TA_HO',
    HIRING_MANAGER: 'HIRING_MANAGER',
    INTERVIEWER: 'INTERVIEWER',
    CANDIDATE: 'CANDIDATE',
  };
  return roleMap[role] || role;
}

function normalizeEmail(v) {
  return String(v ?? '').trim().toLowerCase();
}

async function validateOfficeLocation({ pt, area, areaDetail }) {
  const ptStr = toStringValue(pt);
  const areaStr = toStringValue(area);
  const detailStr = toStringValue(areaDetail);

  if (!ptStr && !areaStr && !detailStr) {
    return { ok: true };
  }

  if (ptStr && areaStr && detailStr) {
    const exists = await prisma.masterOfficeLocation.findUnique({
      where: {
        pt_area_areaDetail: {
          pt: ptStr,
          area: areaStr,
          areaDetail: detailStr,
        },
      },
      select: { id: true },
    });
    return exists ? { ok: true } : { ok: false, message: 'PT/Area/Area Detail combination not found in Master Office Location' };
  }

  if (ptStr && !areaStr && !detailStr) {
    const exists = await prisma.masterOfficeLocation.findFirst({
      where: { pt: ptStr },
      select: { id: true },
    });
    return exists ? { ok: true } : { ok: false, message: `PT "${ptStr}" not found in Master Office Location` };
  }

  if (ptStr && areaStr && !detailStr) {
    const exists = await prisma.masterOfficeLocation.findFirst({
      where: { pt: ptStr, area: areaStr },
      select: { id: true },
    });
    return exists ? { ok: true } : { ok: false, message: `Area "${areaStr}" not found for PT "${ptStr}" in Master Office Location` };
  }

  return { ok: false, message: 'Provide PT only, PT+Area, or PT+Area+Area Detail' };
}

async function validateOfficeLocationLists({ pt, area, areaDetail }) {
  const pts = parseMulti(pt);
  const areas = parseMulti(area);
  const details = parseMulti(areaDetail);

  if (pts.length === 0 || areas.length === 0 || details.length === 0) {
    return { ok: false, message: 'Requires at least one PT, Area, and Area Detail' };
  }

  for (const ptStr of pts) {
    const exists = await prisma.masterOfficeLocation.findFirst({
      where: { pt: ptStr },
      select: { id: true },
    });
    if (!exists) {
      return { ok: false, message: `PT "${ptStr}" not found in Master Office Location` };
    }
  }

  for (const areaStr of areas) {
    const exists = await prisma.masterOfficeLocation.findFirst({
      where: { area: areaStr },
      select: { id: true },
    });
    if (!exists) {
      return { ok: false, message: `Area "${areaStr}" not found in Master Office Location` };
    }
  }

  for (const detailStr of details) {
    const exists = await prisma.masterOfficeLocation.findFirst({
      where: { areaDetail: detailStr },
      select: { id: true },
    });
    if (!exists) {
      return { ok: false, message: `Area Detail "${detailStr}" not found in Master Office Location` };
    }
  }

  return { ok: true };
}

async function importAdminUsers(rows) {
  const result = { total: rows.length, created: 0, failed: 0, errors: [] };
  const defaultPassword = process.env.BULK_DEFAULT_PASSWORD;
  if (!defaultPassword) {
    throw new Error('BULK_DEFAULT_PASSWORD environment variable is required for bulk admin import');
  }

  for (let i = 0; i < rows.length; i += 1) {
    const rowNum = i + 2;
    const row = rows[i] || {};

    const firstName = toStringValue(row['first name']);
    const lastName = toStringValue(row['last name']);
    const email = normalizeEmail(row['email']);
    const phoneNumber = toStringValue(row['phone number']);
    const roleRaw = toStringValue(row['role']);
    const division = toStringValue(row['division']);
    const sectionName = toStringValue(row['section name']);
    const pt = toStringValue(row['pt']);
    const area = toStringValue(row['area']);
    const areaDetail = toStringValue(row['area detail']);
    const password = toStringValue(row['password']);

    if (!email) {
      result.failed += 1;
      result.errors.push({ row: rowNum, message: 'Missing Email' });
      continue;
    }
    if (!firstName) {
      result.failed += 1;
      result.errors.push({ row: rowNum, email, message: 'Missing First Name' });
      continue;
    }
    if (!lastName) {
      result.failed += 1;
      result.errors.push({ row: rowNum, email, message: 'Missing Last Name' });
      continue;
    }
    if (!roleRaw) {
      result.failed += 1;
      result.errors.push({ row: rowNum, email, message: 'Missing Role' });
      continue;
    }

    const mappedRole = mapRoleToEnum(roleRaw);
    const allowedRoles = ['SUPER_ADMIN', 'CHRO', 'DEPARTMENT_HEAD', 'HRBP', 'TA_SITE', 'TA_HO', 'HIRING_MANAGER', 'INTERVIEWER'];
    if (!allowedRoles.includes(mappedRole)) {
      result.failed += 1;
      const msg = mappedRole === 'CANDIDATE' ? 'Role CANDIDATE is not allowed for User Management upload' : `Invalid Role "${roleRaw}"`
      result.errors.push({ row: rowNum, email, message: msg });
      continue;
    }

    // HRBP requires PT/Area/Area Detail. TA_SITE requires PT and Area Detail (Area defaults to Site).
    if (mappedRole === 'HRBP') {
      if (!pt || !area || !areaDetail) {
        result.failed += 1;
        result.errors.push({ row: rowNum, email, message: 'HRBP requires PT, Area, and Area Detail' });
        continue;
      }
    }
    if (mappedRole === 'TA_SITE') {
      if (!pt || !areaDetail) {
        result.failed += 1;
        result.errors.push({ row: rowNum, email, message: 'TA_SITE requires PT and Area Detail' });
        continue;
      }
    }

    const effectiveArea = mappedRole === 'TA_SITE' ? (area || TA_SITE_FIXED_AREA) : area;

    if (mappedRole === 'DEPARTMENT_HEAD') {
      if (!division || !sectionName) {
        result.failed += 1;
        result.errors.push({ row: rowNum, email, message: 'Head of Division requires Division and Section Name' });
        continue;
      }
    }

    try {
      const officeValidation = (mappedRole === 'HRBP' || mappedRole === 'TA_SITE')
        ? await validateOfficeLocationLists({ pt, area: effectiveArea, areaDetail })
        : await validateOfficeLocation({ pt, area: effectiveArea, areaDetail });
      if (!officeValidation.ok) {
        result.failed += 1;
        result.errors.push({ row: rowNum, email, message: officeValidation.message });
        continue;
      }

      const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (existing) {
        result.failed += 1;
        result.errors.push({ row: rowNum, email, message: 'Email already exists' });
        continue;
      }

      const hashed = await bcrypt.hash(password || defaultPassword, 12);
      const hodFields = serializeHodFields({ division, sectionName });
      const hrbpFields = serializeHrbpFields({ pt, area: effectiveArea, areaDetail, role: mappedRole });
      await prisma.user.create({
        data: {
          email,
          password: hashed,
          firstName,
          lastName,
          phoneNumber: phoneNumber || null,
          role: mappedRole,
          division: hodFields.division,
          department: hodFields.department,
          pt: hrbpFields.pt,
          area: hrbpFields.area,
          areaDetail: hrbpFields.areaDetail,
          isActive: true,
          isEmailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });

      result.created += 1;
    } catch (e) {
      result.failed += 1;
      result.errors.push({ row: rowNum, email, message: e.message || 'Failed to create user' });
      logger.warn(`Bulk import user failed row ${rowNum}: ${e.message}`);
    }
  }

  return result;
}

module.exports = {
  importCandidates,
  importMasterDivisions,
  importMasterOfficeLocations,
  importAdminUsers,
};


