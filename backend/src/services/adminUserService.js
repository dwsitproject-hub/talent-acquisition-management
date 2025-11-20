const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const logger = require('../utils/logger');

// Map frontend role names to backend enum values
function mapRoleToEnum(role) {
  if (!role) return role;
  const roleMap = {
    'SUPER_ADMIN': 'SUPER_ADMIN',
    'Management': 'CHRO', // Assuming Management maps to CHRO
    'Head of Division': 'DEPARTMENT_HEAD',
    'HRBP': 'HRBP',
    'TA_TEAM': 'TA_TEAM',
    'HIRING_MANAGER': 'HIRING_MANAGER',
    'INTERVIEWER': 'INTERVIEWER',
    'CANDIDATE': 'CANDIDATE',
  };
  const mapped = roleMap[role] || role; // Fallback to original if not in map
  if (mapped !== role) {
    logger.info(`Role mapping: "${role}" -> "${mapped}"`);
  }
  return mapped;
}

// Map backend enum values to frontend role names
function mapEnumToRole(role) {
  const roleMap = {
    'SUPER_ADMIN': 'SUPER_ADMIN',
    'CHRO': 'Management',
    'DEPARTMENT_HEAD': 'Head of Division',
    'HRBP': 'HRBP',
    'TA_TEAM': 'TA_TEAM',
    'HIRING_MANAGER': 'HIRING_MANAGER',
    'INTERVIEWER': 'INTERVIEWER',
    'CANDIDATE': 'CANDIDATE',
  };
  return roleMap[role] || role; // Fallback to original if not in map
}

function mapUser(u) {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phoneNumber || null,
    role: mapEnumToRole(u.role), // Map backend enum to frontend role name
    division: u.division || '-',
    sectionName: u.department || '-', // store section in department
    pt: u.pt || null,
    area: u.area || null,
    areaDetail: u.areaDetail || null,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt || null,
  };
}

async function listUsers(search, role) {
  const where = {};
  
  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
    ];
  }
  
  if (role) {
    // Map frontend role name to backend enum
    const mappedRole = mapRoleToEnum(role);
    where.role = mappedRole;
  }
  
  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  return users.map(mapUser);
}

async function createUser(data) {
  const {
    email,
    password,
    firstName,
    lastName,
    phone,
    role,
    division,
    sectionName,
    pt,
    area,
    areaDetail,
  } = data;

  const hashed = await bcrypt.hash(password || 'DefaultPassword123!', 12);
  
  // Map role to enum value
  const mappedRole = mapRoleToEnum(role);
  logger.info(`Creating user with role: "${role}" -> mapped to: "${mappedRole}"`);
  
  // Use raw SQL to avoid Prisma enum case sensitivity issues
  // Escape single quotes in string values
  const escapeSql = (str) => (str || '').replace(/'/g, "''");
  const sql = `
    INSERT INTO users (id, email, password, "firstName", "lastName", "phoneNumber", role, division, department, pt, area, "areaDetail", "isActive", "isEmailVerified", "emailVerifiedAt", "createdAt", "updatedAt")
    VALUES (
      gen_random_uuid(),
      '${escapeSql(email)}',
      '${escapeSql(hashed)}',
      '${escapeSql(firstName)}',
      '${escapeSql(lastName)}',
      ${phone ? `'${escapeSql(phone)}'` : 'NULL'},
      '${escapeSql(mappedRole)}'::userrole,
      ${division ? `'${escapeSql(division)}'` : 'NULL'},
      ${sectionName ? `'${escapeSql(sectionName)}'` : 'NULL'},
      ${pt ? `'${escapeSql(pt)}'` : 'NULL'},
      ${area ? `'${escapeSql(area)}'` : 'NULL'},
      ${areaDetail ? `'${escapeSql(areaDetail)}'` : 'NULL'},
      true,
      true,
      NOW(),
      NOW(),
      NOW()
    )
    RETURNING *
  `;
  const result = await prisma.$queryRawUnsafe(sql);
  return mapUser(result[0]);
}

async function updateUser(id, data) {
  // Map role to enum value
  const mappedRole = mapRoleToEnum(data.role);
  
  // Use raw SQL to avoid Prisma enum case sensitivity issues
  // Escape single quotes in string values
  const escapeSql = (str) => (str || '').replace(/'/g, "''");
  const sql = `
    UPDATE users 
    SET "firstName" = '${escapeSql(data.firstName)}',
        "lastName" = '${escapeSql(data.lastName)}',
        email = '${escapeSql(data.email)}',
        "phoneNumber" = ${data.phone ? `'${escapeSql(data.phone)}'` : 'NULL'},
        role = '${escapeSql(mappedRole)}'::userrole,
        division = ${data.division ? `'${escapeSql(data.division)}'` : 'NULL'},
        department = ${data.sectionName ? `'${escapeSql(data.sectionName)}'` : 'NULL'},
        pt = ${data.pt ? `'${escapeSql(data.pt)}'` : 'NULL'},
        area = ${data.area ? `'${escapeSql(data.area)}'` : 'NULL'},
        "areaDetail" = ${data.areaDetail ? `'${escapeSql(data.areaDetail)}'` : 'NULL'},
        "updatedAt" = NOW()
    WHERE id = '${escapeSql(id)}'
    RETURNING *
  `;
  const result = await prisma.$queryRawUnsafe(sql);
  return mapUser(result[0]);
}

async function updateStatus(id, isActive) {
  const user = await prisma.user.update({ where: { id }, data: { isActive } });
  return mapUser(user);
}

async function resetPassword(id, newPassword) {
  const hashed = await bcrypt.hash(newPassword || 'DefaultPassword123!', 12);
  await prisma.user.update({
    where: { id },
    data: { password: hashed, failedLoginCount: 0, lockedUntil: null },
  });
}

module.exports = {
  listUsers,
  createUser,
  updateUser,
  updateStatus,
  resetPassword,
};


