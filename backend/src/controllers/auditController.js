const auditService = require('../services/auditService');
const { asyncHandler } = require('../middleware/errorHandler');

async function listAuditLogs(req, res) {
  const result = await auditService.listAuditLogs({
    page: req.query.page,
    limit: req.query.limit,
    action: req.query.action,
    entity: req.query.entity,
    entityId: req.query.entityId,
    userId: req.query.userId,
    from: req.query.from,
    to: req.query.to,
    search: req.query.search,
  });

  res.json({
    success: true,
    data: result,
  });
}

async function getAuditLog(req, res) {
  const log = await auditService.getAuditLogById(req.params.id);

  if (!log) {
    return res.status(404).json({
      success: false,
      message: 'Audit log not found',
    });
  }

  res.json({
    success: true,
    data: log,
  });
}

module.exports = {
  listAuditLogs: asyncHandler(listAuditLogs),
  getAuditLog: asyncHandler(getAuditLog),
};
