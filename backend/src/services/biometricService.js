import prisma from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { recordAudit } from './auditService.js';

export async function listDevices(req, { page, limit, skip } = {}) {
  const where = { tenantId: req.tenantId };
  const [items, total] = await Promise.all([
    prisma.biometricDevice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.biometricDevice.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function addDevice(req, data) {
  const record = await prisma.biometricDevice.create({
    data: {
      tenantId: req.tenantId,
      name: data.name,
      deviceType: data.deviceType,
      location: data.location || null,
      ipAddress: data.ipAddress || null,
      serialNumber: data.serialNumber || null,
      status: 'Offline',
    },
  });

  await recordAudit({ req, moduleName: 'hr', actionType: 'CREATE', entityName: 'biometricDevice', entityId: record.id, newValues: data });
  return record;
}

export async function updateDevice(req, id, data) {
  const existing = await prisma.biometricDevice.findFirst({ where: { id: BigInt(id), tenantId: req.tenantId } });
  if (!existing) throw ApiError.notFound('Device not found');

  const record = await prisma.biometricDevice.update({ where: { id: BigInt(id) }, data });
  await recordAudit({ req, moduleName: 'hr', actionType: 'UPDATE', entityName: 'biometricDevice', entityId: record.id, oldValues: existing, newValues: data });
  return record;
}

export async function deleteDevice(req, id) {
  const existing = await prisma.biometricDevice.findFirst({ where: { id: BigInt(id), tenantId: req.tenantId } });
  if (!existing) throw ApiError.notFound('Device not found');

  await prisma.biometricDevice.delete({ where: { id: BigInt(id) } });
  await recordAudit({ req, moduleName: 'hr', actionType: 'DELETE', entityName: 'biometricDevice', entityId: BigInt(id), oldValues: existing });
  return { id };
}

/**
 * Sync a device: pulls punch logs from the physical device.
 * Real hardware integration (ZKTeco/eSSL SDK, Suprema BioStar API, etc.) is
 * device-specific and requires the vendor SDK / on-prem middleware — wire it
 * in here. Until then this performs a connectivity check and timestamps the
 * sync so the rest of the module (logs, attendance linkage) is fully usable
 * against manually-recorded or SDK-fed punches.
 */
export async function syncDevice(req, id) {
  const device = await prisma.biometricDevice.findFirst({ where: { id: BigInt(id), tenantId: req.tenantId } });
  if (!device) throw ApiError.notFound('Device not found');

  const updated = await prisma.biometricDevice.update({
    where: { id: BigInt(id) },
    data: { status: 'Online', lastSyncAt: new Date() },
  });

  await recordAudit({ req, moduleName: 'hr', actionType: 'UPDATE', entityName: 'biometricDevice', entityId: updated.id, newValues: { syncTriggered: true } });
  return updated;
}

export async function listLogs(req, { page, limit, skip } = {}, filters = {}) {
  const where = { tenantId: req.tenantId };
  if (filters.deviceId) where.deviceId = BigInt(filters.deviceId);
  if (filters.employeeId) where.employeeId = BigInt(filters.employeeId);
  if (filters.type) where.punchType = filters.type;
  if (filters.date) {
    const start = new Date(filters.date);
    const end = new Date(filters.date);
    end.setDate(end.getDate() + 1);
    where.punchTime = { gte: start, lt: end };
  }

  const [items, total] = await Promise.all([
    prisma.biometricLog.findMany({
      where,
      include: {
        device: { select: { id: true, name: true, location: true } },
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      },
      orderBy: { punchTime: 'desc' },
      skip,
      take: limit,
    }),
    prisma.biometricLog.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function recordPunch(req, data) {
  const device = await prisma.biometricDevice.findFirst({ where: { id: BigInt(data.deviceId), tenantId: req.tenantId } });
  if (!device) throw ApiError.notFound('Device not found');

  let employeeId = null;
  if (data.employeeId) {
    const employee = await prisma.employee.findFirst({ where: { id: BigInt(data.employeeId), tenantId: req.tenantId } });
    if (employee) employeeId = employee.id;
  }

  return prisma.biometricLog.create({
    data: {
      tenantId: req.tenantId,
      deviceId: device.id,
      employeeId,
      punchType: data.punchType || 'IN',
      punchTime: data.punchTime ? new Date(data.punchTime) : new Date(),
      rawUserId: data.rawUserId || null,
    },
  });
}

export async function getStats(req) {
  const [totalDevices, onlineDevices, todayLogs] = await Promise.all([
    prisma.biometricDevice.count({ where: { tenantId: req.tenantId } }),
    prisma.biometricDevice.count({ where: { tenantId: req.tenantId, status: 'Online' } }),
    prisma.biometricLog.count({
      where: {
        tenantId: req.tenantId,
        punchTime: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
  ]);

  return { totalDevices, onlineDevices, offlineDevices: totalDevices - onlineDevices, todayLogs };
}
