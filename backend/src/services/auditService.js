import prisma from '../config/prisma.js';
import { logger } from '../utils/logger.js';

/**
 * Fire-and-forget audit trail writer. Failures here must never break the
 * primary request, so errors are swallowed and logged instead of thrown.
 */
export async function recordAudit({ req, moduleName, actionType, entityName, entityId, oldValues, newValues }) {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user?.id,
        moduleName,
        actionType, // 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT'
        entityName,
        entityId: entityId ? BigInt(entityId) : null,
        oldValues: oldValues ?? undefined,
        newValues: newValues ?? undefined,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
  } catch (err) {
    logger.warn(`Failed to write audit log: ${err.message}`);
  }
}

export default recordAudit;
