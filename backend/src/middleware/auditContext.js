const { runWithAuditContext, createRequestAuditContext } = require('../utils/auditContext');

function auditContextMiddleware(req, res, next) {
  runWithAuditContext(createRequestAuditContext(req), () => next());
}

module.exports = auditContextMiddleware;
