const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const logger = require('../utils/logger');
const { serializeHrbpFields } = require('../utils/hrbpScope');
const { serializeHodFields } = require('../utils/hodScope');

// Map frontend role names to backend enum values
function mapRoleToEnum(role) {
  if (!role) return role;
  const roleMap = {
    'SUPER_ADMIN': 'SUPER_ADMIN',
    'Management': 'CHRO', // Assuming Management maps to CHRO
    'Head of Division': 'DEPARTMENT_HEAD',
    'HRBP': 'HRBP',
    'TA_HO': 'TA_HO',
    'TA_SITE': 'TA_SITE',
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
    'TA_HO': 'TA_HO',
    'TA_SITE': 'TA_SITE',
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

  if (!password) {
    throw new Error('Password is required when creating a user');
  }
  const hashed = await bcrypt.hash(password, 12);
  
  // Map role to enum value
  const mappedRole = mapRoleToEnum(role);
  logger.info(`Creating user with role: "${role}" -> mapped to: "${mappedRole}"`);

  const hodFields = serializeHodFields({ division, sectionName });
  const hrbpFields = serializeHrbpFields({ pt, area, areaDetail, role: mappedRole });
  
  // Use Prisma client to avoid enum type name mismatch issues
  // Prisma handles enum mapping correctly
  const user = await prisma.user.create({
    data: {
      email,
      password: hashed,
      firstName,
      lastName,
      phoneNumber: phone || null,
      role: mappedRole, // Prisma will map enum correctly
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
  
  return mapUser(user);
}

async function updateUser(id, data) {
  // Map role to enum value
  const mappedRole = mapRoleToEnum(data.role);
  
  // Helper to convert empty strings to null
  const toNullIfEmpty = (value) => {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    return String(value).trim() || null;
  };
  
  const hodFields = serializeHodFields({ division: data.division, sectionName: data.sectionName });
  const hrbpFields = serializeHrbpFields({
    pt: data.pt,
    area: data.area,
    areaDetail: data.areaDetail,
    role: mappedRole,
  });

  // Use Prisma client to avoid enum type name mismatch issues
  // Prisma handles enum mapping correctly
  const updateData = {
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phoneNumber: toNullIfEmpty(data.phone),
    role: mappedRole, // Prisma will map enum correctly
    division: hodFields.division,
    department: hodFields.department,
    pt: hrbpFields.pt,
    area: hrbpFields.area,
    areaDetail: hrbpFields.areaDetail,
  };
  
  logger.info(`Updating user ${id} with data:`, {
    division: updateData.division,
    department: updateData.department,
    role: updateData.role,
  });
  
  try {
    // Check if user exists first
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });
    
    if (!existingUser) {
      throw new Error(`User with id ${id} not found`);
    }
    
    const user = await prisma.user.update({
      where: { id },
      data: updateData,
    });
    
    logger.info(`Successfully updated user ${id}`);
    return mapUser(user);
  } catch (error) {
    logger.error(`Error updating user ${id}:`, {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack,
    });
    throw error;
  }
}

async function updateStatus(id, isActive) {
  const user = await prisma.user.update({ where: { id }, data: { isActive } });
  return mapUser(user);
}

async function resetPassword(id, newPassword) {
  if (!newPassword) {
    throw new Error('New password is required');
  }
  const hashed = await bcrypt.hash(newPassword, 12);
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


