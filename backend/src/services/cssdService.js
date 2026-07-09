import prisma from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { createCrudService } from './crudServiceFactory.js';

export const cssdItemService = createCrudService('cssdItem', {
  searchFields: ['name', 'itemCode', 'category'],
  moduleName: 'cssd',
  entityLabel: 'CSSD Item',
  softDelete: false,
});

// ── Packs ─────────────────────────────────────────────────────────────────────

export async function listPacks(req, { page, limit, skip }, filters = {}) {
  const where = { tenantId: req.tenantId };
  if (filters.status) where.status = filters.status;
  if (filters.department) where.department = { contains: filters.department };

  const [items, total] = await Promise.all([
    prisma.cssdPack.findMany({
      where,
      include: { items: { include: { item: { select: { id: true, name: true, itemCode: true } } } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.cssdPack.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function createPack(req, data) {
  const count = await prisma.cssdPack.count({ where: { tenantId: req.tenantId } });
  const packCode = `PKG-${String(count + 1).padStart(5, '0')}`;

  const pack = await prisma.cssdPack.create({
    data: {
      tenantId: req.tenantId,
      packCode,
      packName: data.packName,
      department: data.department || null,
      notes: data.notes || null,
    },
  });

  if (data.items && Array.isArray(data.items) && data.items.length > 0) {
    await prisma.cssdPackItem.createMany({
      data: data.items.map(i => ({
        packId: pack.id,
        itemId: BigInt(i.itemId),
        quantity: parseInt(i.quantity) || 1,
      })),
    });
  }

  return prisma.cssdPack.findFirst({
    where: { id: pack.id },
    include: { items: { include: { item: { select: { id: true, name: true, itemCode: true } } } } },
  });
}

export async function updatePackStatus(req, packId, status) {
  const pack = await prisma.cssdPack.findFirst({ where: { id: BigInt(packId), tenantId: req.tenantId } });
  if (!pack) throw ApiError.notFound('Pack not found');

  const data = { status };

  if (status === 'Sterile') {
    data.sterilizedAt = new Date();
    // Sterile packs expire in 7 days by default
    const exp = new Date();
    exp.setDate(exp.getDate() + 7);
    data.expiresAt = exp;
    // Update all items in the pack to Sterile
    await prisma.cssdPackItem.findMany({ where: { packId: BigInt(packId) } }).then(async (packItems) => {
      for (const pi of packItems) {
        await prisma.cssdItem.update({ where: { id: pi.itemId }, data: { status: 'Sterile' } });
      }
    });
  }

  if (status === 'InUse') {
    data.usedAt = new Date();
    // Mark items as in use
    const packItems = await prisma.cssdPackItem.findMany({ where: { packId: BigInt(packId) } });
    for (const pi of packItems) {
      await prisma.cssdItem.update({ where: { id: pi.itemId }, data: { status: 'InUse' } });
    }
  }

  if (status === 'Dirty') {
    // Return from use — mark items dirty for re-sterilization
    const packItems = await prisma.cssdPackItem.findMany({ where: { packId: BigInt(packId) } });
    for (const pi of packItems) {
      await prisma.cssdItem.update({ where: { id: pi.itemId }, data: { status: 'Dirty' } });
    }
  }

  return prisma.cssdPack.update({
    where: { id: BigInt(packId) },
    data,
    include: { items: { include: { item: { select: { id: true, name: true } } } } },
  });
}

// ── Cycles ────────────────────────────────────────────────────────────────────

export async function listCycles(req, { page, limit, skip }, filters = {}) {
  const where = { tenantId: req.tenantId };
  if (filters.isSuccessful !== undefined) where.isSuccessful = filters.isSuccessful === 'true';
  if (filters.method) where.sterilizationMethod = filters.method;

  const [items, total] = await Promise.all([
    prisma.cssdCycle.findMany({
      where,
      include: {
        items: { include: { pack: { select: { id: true, packCode: true, packName: true } } } },
      },
      orderBy: { startedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.cssdCycle.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function createCycle(req, data) {
  const count = await prisma.cssdCycle.count({ where: { tenantId: req.tenantId } });
  const cycleNumber = `CYC-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

  const cycle = await prisma.cssdCycle.create({
    data: {
      tenantId: req.tenantId,
      cycleNumber,
      autoclaveName: data.autoclaveName || null,
      sterilizationMethod: data.sterilizationMethod,
      startedAt: new Date(data.startedAt || Date.now()),
      temperature: data.temperature ? parseFloat(data.temperature) : null,
      pressure: data.pressure ? parseFloat(data.pressure) : null,
      duration: data.duration ? parseInt(data.duration) : null,
      batchIndicator: data.batchIndicator || null,
      operatorId: data.operatorId ? BigInt(data.operatorId) : null,
      notes: data.notes || null,
    },
  });

  if (data.packIds && Array.isArray(data.packIds) && data.packIds.length > 0) {
    await prisma.cssdCycleItem.createMany({
      data: data.packIds.map(pid => ({ cycleId: cycle.id, packId: BigInt(pid) })),
    });

    // Move packs to Sterilizing status
    for (const pid of data.packIds) {
      await prisma.cssdPack.update({ where: { id: BigInt(pid) }, data: { status: 'Sterilizing' } });
    }
  }

  return prisma.cssdCycle.findFirst({
    where: { id: cycle.id },
    include: { items: { include: { pack: { select: { id: true, packCode: true, packName: true } } } } },
  });
}

export async function completeCycle(req, cycleId, data) {
  const cycle = await prisma.cssdCycle.findFirst({ where: { id: BigInt(cycleId), tenantId: req.tenantId } });
  if (!cycle) throw ApiError.notFound('Cycle not found');

  const isSuccessful = data.isSuccessful !== false;
  await prisma.cssdCycle.update({
    where: { id: BigInt(cycleId) },
    data: {
      completedAt: new Date(),
      isSuccessful,
      failureReason: isSuccessful ? null : (data.failureReason || 'Unknown failure'),
      batchIndicator: data.batchIndicator || cycle.batchIndicator,
    },
  });

  // Update packs to Sterile or Dirty based on result
  const cycleItems = await prisma.cssdCycleItem.findMany({ where: { cycleId: BigInt(cycleId) } });
  for (const ci of cycleItems) {
    if (isSuccessful) {
      await updatePackStatus(req, ci.packId, 'Sterile');
    } else {
      await updatePackStatus(req, ci.packId, 'Dirty');
    }
  }

  return prisma.cssdCycle.findFirst({
    where: { id: BigInt(cycleId) },
    include: { items: { include: { pack: true } } },
  });
}

export async function getCssdStats(req) {
  const [totalItems, dueForSterile, sterileReady, expiringToday, totalCycles] = await Promise.all([
    prisma.cssdItem.count({ where: { tenantId: req.tenantId, isActive: true } }),
    prisma.cssdItem.count({ where: { tenantId: req.tenantId, status: { in: ['Dirty', 'Washing'] } } }),
    prisma.cssdPack.count({ where: { tenantId: req.tenantId, status: 'Sterile' } }),
    prisma.cssdPack.count({
      where: {
        tenantId: req.tenantId,
        status: 'Sterile',
        expiresAt: { lte: new Date(Date.now() + 24 * 3600 * 1000) },
      },
    }),
    prisma.cssdCycle.count({ where: { tenantId: req.tenantId } }),
  ]);
  return { totalItems, dueForSterile, sterileReady, expiringToday, totalCycles };
}
