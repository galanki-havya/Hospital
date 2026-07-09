import { writeAuditLog } from '../services/clinicalCoreService.js';

// Map HTTP methods to action verbs
const METHOD_ACTION = {
  POST: 'CREATE',
  PATCH: 'UPDATE',
  PUT: 'UPDATE',
  DELETE: 'DELETE',
};

// Modules to skip detailed auditing (high-frequency reads)
const SKIP_PATHS = ['/api/v1/realtime', '/api/v1/audit-ext', '/api/v1/notifications/'];

/**
 * Auto-audit middleware.
 * Wraps res.json to capture the response, then writes an audit entry.
 * Only logs POST/PATCH/PUT/DELETE — not GET.
 */
export function auditMiddleware(req, res, next) {
  const method = req.method?.toUpperCase();

  // Only audit mutating operations
  if (!METHOD_ACTION[method]) return next();

  // Skip noisy paths
  if (SKIP_PATHS.some(p => req.path.startsWith(p))) return next();

  // Capture original json
  const originalJson = res.json.bind(res);

  res.json = function (body) {
    // Only log if successful (2xx)
    if (res.statusCode >= 200 && res.statusCode < 300 && req.tenantId) {
      const pathParts = req.path.split('/').filter(Boolean);
      const module = pathParts[2] || 'unknown'; // /api/v1/<module>/...
      const action = METHOD_ACTION[method];
      const entityType = pathParts[2] || 'unknown';
      const entityId = pathParts[3] || body?.data?.id || 'unknown';

      writeAuditLog(req, {
        module,
        action,
        entityType,
        entityId: String(entityId),
        description: `${method} ${req.path}`,
        newValue: method !== 'DELETE' ? (body?.data || null) : null,
        severity: action === 'DELETE' ? 'WARNING' : 'INFO',
      }).catch(() => { /* never block response on audit failure */ });
    }

    return originalJson(body);
  };

  next();
}
