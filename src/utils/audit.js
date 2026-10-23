import AuditLog from '../models/AuditLog.js';

// Fire-and-forget: audit failures must never break the request.
export default function audit(req, action, entity, entityId, meta = {}) {
  AuditLog.create({
    actor: req?.user?._id,
    action,
    entity,
    entityId: entityId ? String(entityId) : undefined,
    meta,
    ip: req?.ip,
  }).catch((e) => console.error('audit failed:', e.message));
};
