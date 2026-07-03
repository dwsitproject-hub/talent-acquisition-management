const { AsyncLocalStorage } = require('async_hooks');
const { randomUUID } = require('crypto');

const auditContext = new AsyncLocalStorage();

function runWithAuditContext(context, fn) {
  return auditContext.run(context, fn);
}

function getAuditContext() {
  return auditContext.getStore() || {};
}

function setAuditUserId(userId) {
  const store = auditContext.getStore();
  if (store) {
    store.userId = userId;
  }
}

function isAuditSuppressed(model) {
  const store = auditContext.getStore();
  if (!store) return false;
  if (store.suppressAll) return true;
  if (store.suppressedModels instanceof Set && store.suppressedModels.has(model)) {
    return true;
  }
  return false;
}

/**
 * Temporarily disable automatic Prisma audit logging (e.g. during cascaded
 * sync writes). Call writeAuditLog manually once for the business action.
 */
async function runWithAuditSuppressed(fn) {
  const store = auditContext.getStore();
  if (!store) {
    return fn();
  }

  const previous = store.suppressAll;
  store.suppressAll = true;
  try {
    return await fn();
  } finally {
    store.suppressAll = previous;
  }
}

function createRequestAuditContext(req) {
  return {
    userId: null,
    requestId: randomUUID(),
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] || null,
    suppressAll: false,
    suppressedModels: new Set(),
  };
}

module.exports = {
  auditContext,
  runWithAuditContext,
  getAuditContext,
  setAuditUserId,
  isAuditSuppressed,
  runWithAuditSuppressed,
  createRequestAuditContext,
};
