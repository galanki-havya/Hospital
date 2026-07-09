import prisma from '../config/prisma.js';
import { logger } from '../utils/logger.js';

/**
 * Fire-and-forget audit trail writer for platform (Developer/SuperAdmin)
 * actions. Kept separate from the tenant auditService/AuditLog table —
 * platform actions are never tenant-scoped.
 */
export async function recordPlatformAudit({ platformUserId, actionType, targetTenantId, metadata, ipAddress }) {
  try {
    await prisma.platformAuditLog.create({
      data: {
        platformUserId: platformUserId ? BigInt(platformUserId) : null,
        actionType,
        targetTenantId: targetTenantId ? BigInt(targetTenantId) : null,
        metadata: metadata ?? undefined,
        ipAddress: ipAddress ?? null,
      },
    });
  } catch (err) {
    logger.warn(`Failed to write platform audit log: ${err.message}`);
  }
}

export default recordPlatformAudit;
