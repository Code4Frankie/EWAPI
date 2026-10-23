const AuditLog = require('../models/AuditLog');

// Fire-and-forget: audit failures must never break the request.
module.exports = function audit(req, action, entity, entityId, meta = {}) {
  AuditLog.create({
    actor: req?.user?._id,
    action,
    entity,
    entityId: entityId ? String(entityId) : undefined,
    meta,
    ip: req?.ip,
  }).catch((e) => console.error('audit failed:', e.message));
};
