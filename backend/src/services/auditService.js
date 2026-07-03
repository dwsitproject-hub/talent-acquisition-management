const prismaBase = require('../config/prismaBase');
const { getAuditContext } = require('../utils/auditContext');
const logger = require('../utils/logger');

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'refreshToken',
  'accessToken',
  'secret',
  'otp',
  'verificationCode',
]);

const IGNORE_COMPARE_KEYS = new Set(['updatedAt', 'createdAt']);

const MAX_JSON_DEPTH = 6;

function sanitizeValue(value, depth = 0) {
  if (value == null || depth > MAX_JSON_DEPTH) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value !== 'object') return value;

  const output = {};
  for (const [key, val] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(key)) {
      output[key] = '[REDACTED]';
    } else {
      output[key] = sanitizeValue(val, depth + 1);
    }
  }
  return output;
}

function extractEntityId(record, where) {
  if (record && record.id) return String(record.id);
  if (where && where.id) return String(where.id);
  return null;
}

function stripIgnoredAuditFields(value) {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  const output = { ...value };
  IGNORE_COMPARE_KEYS.forEach((key) => {
    delete output[key];
  });
  return output;
}

function isNoOpAuditChange(oldValues, newValues) {
  if (!oldValues || !newValues) return false;
  const oldSanitized = stripIgnoredAuditFields(sanitizeValue(oldValues));
  const newSanitized = stripIgnoredAuditFields(sanitizeValue(newValues));
  return JSON.stringify(oldSanitized) === JSON.stringify(newSanitized);
}

function buildChangedFieldSnapshot(before, after, fields) {
  const oldSnapshot = {};
  const newSnapshot = {};
  for (const field of fields) {
    const oldVal = before?.[field];
    const newVal = after?.[field];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      oldSnapshot[field] = oldVal ?? null;
      newSnapshot[field] = newVal ?? null;
    }
  }
  return { oldSnapshot, newSnapshot };
}

async function writeAuditLog({
  action,
  entity,
  entityId = null,
  oldValues = null,
  newValues = null,
  userId = null,
  ipAddress = null,
  userAgent = null,
  requestId = null,
  summary = null,
}) {
  const ctx = getAuditContext();

  if (action === 'UPDATE' && isNoOpAuditChange(oldValues, newValues)) {
    return;
  }

  const payloadNewValues = summary
    ? { ...(newValues && typeof newValues === 'object' ? newValues : {}), _summary: summary }
    : newValues;

  try {
    await prismaBase.auditLog.create({
      data: {
        action,
        entity,
        entityId,
        oldValues: oldValues ? sanitizeValue(oldValues) : null,
        newValues: payloadNewValues ? sanitizeValue(payloadNewValues) : null,
        userId: userId || ctx.userId || null,
        ipAddress: ipAddress || ctx.ipAddress || null,
        userAgent: userAgent || ctx.userAgent || null,
        requestId: requestId || ctx.requestId || null,
      },
    });
  } catch (error) {
    logger.error('Failed to write audit log:', error);
  }
}

async function recordAuthEvent(action, userId, metadata = {}) {
  await writeAuditLog({
    action,
    entity: 'User',
    entityId: userId,
    newValues: { userId },
    userId,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  });
}

async function listAuditLogs(filters = {}) {
  const page = Math.max(parseInt(filters.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 50, 1), 200);
  const skip = (page - 1) * limit;

  const where = {};

  if (filters.action) {
    where.action = filters.action;
  }

  if (filters.entity) {
    where.entity = { contains: filters.entity, mode: 'insensitive' };
  }

  if (filters.entityId) {
    where.entityId = filters.entityId;
  }

  if (filters.userId) {
    where.userId = filters.userId;
  }

  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) {
      where.createdAt.gte = new Date(filters.from);
    }
    if (filters.to) {
      const toDate = new Date(filters.to);
      toDate.setHours(23, 59, 59, 999);
      where.createdAt.lte = toDate;
    }
  }

  if (filters.search) {
    const search = String(filters.search).trim();
    where.OR = [
      { entity: { contains: search, mode: 'insensitive' } },
      { entityId: { contains: search, mode: 'insensitive' } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
      { user: { firstName: { contains: search, mode: 'insensitive' } } },
      { user: { lastName: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [items, total] = await Promise.all([
    prismaBase.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    }),
    prismaBase.auditLog.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

async function getAuditLogById(id) {
  return prismaBase.auditLog.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      },
    },
  });
}

module.exports = {
  sanitizeValue,
  extractEntityId,
  isNoOpAuditChange,
  buildChangedFieldSnapshot,
  writeAuditLog,
  recordAuthEvent,
  listAuditLogs,
  getAuditLogById,
};
