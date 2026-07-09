import prisma from '../config/prisma.js';
import { emit } from './realtimeService.js';
import { ApiError } from '../utils/ApiError.js';
import { createCrudService } from './crudServiceFactory.js';

// ── SERVICE MASTER ─────────────────────────────────────────────────────────────

export const serviceMasterService = createCrudService('serviceMaster', {
  searchFields: ['name', 'serviceCode'],
  moduleName: 'billing',
  entityLabel: 'Service',
  include: { department: { select: { id: true, name: true } } },
  softDelete: false,
});

export async function listServices(req, { page, limit, skip }, filters = {}) {
  const where = { tenantId: req.tenantId, isActive: true };
  if (filters.serviceType) where.serviceType = filters.serviceType;
  if (filters.departmentId) where.departmentId = BigInt(filters.departmentId);
  if (filters.search) where.OR = [
    { name: { contains: filters.search } },
    { serviceCode: { contains: filters.search } },
  ];

  const [items, total] = await Promise.all([
    prisma.serviceMaster.findMany({
      where,
      include: { department: { select: { id: true, name: true } } },
      orderBy: [{ serviceType: 'asc' }, { name: 'asc' }],
      skip,
      take: limit,
    }),
    prisma.serviceMaster.count({ where }),
  ]);
  return { items, total, page, limit };
}

// ── ENCOUNTERS ─────────────────────────────────────────────────────────────────

const encounterInclude = {
  patient: { select: { id: true, firstName: true, lastName: true, uhid: true, phone: true } },
  doctor: { select: { id: true, firstName: true, lastName: true, specialization: true } },
  orders: {
    select: { id: true, orderType: true, status: true, priority: true, orderedAt: true },
    orderBy: { orderedAt: 'desc' },
    take: 10,
  },
};

export async function listEncounters(req, { page, limit, skip }, filters = {}) {
  const where = { tenantId: req.tenantId };
  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;
  if (filters.patientId) where.patientId = BigInt(filters.patientId);
  if (filters.doctorId) where.doctorId = BigInt(filters.doctorId);
  if (filters.date) {
    const d = new Date(filters.date);
    where.startTime = { gte: d, lt: new Date(d.getTime() + 86400000) };
  }

  const [items, total] = await Promise.all([
    prisma.encounter.findMany({
      where,
      include: encounterInclude,
      orderBy: { startTime: 'desc' },
      skip,
      take: limit,
    }),
    prisma.encounter.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function createEncounter(req, data) {
  const patient = await prisma.patient.findFirst({ where: { id: BigInt(data.patientId), tenantId: req.tenantId } });
  if (!patient) throw ApiError.notFound('Patient not found');

  return prisma.encounter.create({
    data: {
      tenantId: req.tenantId,
      patientId: BigInt(data.patientId),
      doctorId: data.doctorId ? BigInt(data.doctorId) : null,
      type: data.type,
      referenceType: data.referenceType || data.type,
      referenceId: BigInt(data.referenceId || 0),
      startTime: new Date(data.startTime || Date.now()),
      chiefComplaint: data.chiefComplaint || null,
      diagnosis: data.diagnosis || null,
      notes: data.notes || null,
    },
    include: encounterInclude,
  });
}

export async function closeEncounter(req, encounterId) {
  const encounter = await prisma.encounter.findFirst({ where: { id: BigInt(encounterId), tenantId: req.tenantId } });
  if (!encounter) throw ApiError.notFound('Encounter not found');
  return prisma.encounter.update({
    where: { id: BigInt(encounterId) },
    data: { status: 'Completed', endTime: new Date() },
    include: encounterInclude,
  });
}

export async function getEncounterById(req, encounterId) {
  const encounter = await prisma.encounter.findFirst({
    where: { id: BigInt(encounterId), tenantId: req.tenantId },
    include: {
      ...encounterInclude,
      orders: {
        include: { service: { select: { id: true, name: true, serviceType: true } } },
        orderBy: { orderedAt: 'desc' },
      },
    },
  });
  if (!encounter) throw ApiError.notFound('Encounter not found');
  return encounter;
}

export async function getPatientEncounterHistory(req, patientId) {
  return prisma.encounter.findMany({
    where: { tenantId: req.tenantId, patientId: BigInt(patientId) },
    include: {
      doctor: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { orders: true } },
    },
    orderBy: { startTime: 'desc' },
    take: 20,
  });
}

// ── CLINICAL ORDERS ────────────────────────────────────────────────────────────

export async function listOrders(req, { page, limit, skip }, filters = {}) {
  const where = { tenantId: req.tenantId };
  if (filters.orderType) where.orderType = filters.orderType;
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.patientId) where.patientId = BigInt(filters.patientId);
  if (filters.encounterId) where.encounterId = BigInt(filters.encounterId);

  const [items, total] = await Promise.all([
    prisma.clinicalOrder.findMany({
      where,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, uhid: true } },
        doctor: { select: { id: true, firstName: true, lastName: true } },
        service: { select: { id: true, name: true, serviceType: true } },
        encounter: { select: { id: true, type: true, status: true } },
      },
      orderBy: [{ priority: 'asc' }, { orderedAt: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.clinicalOrder.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function createOrder(req, data) {
  const patient = await prisma.patient.findFirst({ where: { id: BigInt(data.patientId), tenantId: req.tenantId } });
  if (!patient) throw ApiError.notFound('Patient not found');

  return prisma.clinicalOrder.create({
    data: {
      tenantId: req.tenantId,
      encounterId: data.encounterId ? BigInt(data.encounterId) : null,
      patientId: BigInt(data.patientId),
      doctorId: BigInt(data.doctorId),
      orderType: data.orderType,
      serviceId: data.serviceId ? BigInt(data.serviceId) : null,
      referenceType: data.referenceType || null,
      referenceId: data.referenceId ? BigInt(data.referenceId) : null,
      priority: data.priority || 'Routine',
      notes: data.notes || null,
    },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, uhid: true } },
      doctor: { select: { id: true, firstName: true, lastName: true } },
      service: { select: { id: true, name: true, serviceType: true } },
    },
  });
}

export async function updateOrderStatus(req, orderId, status) {
  const order = await prisma.clinicalOrder.findFirst({ where: { id: BigInt(orderId), tenantId: req.tenantId } });
  if (!order) throw ApiError.notFound('Order not found');

  return prisma.clinicalOrder.update({
    where: { id: BigInt(orderId) },
    data: {
      status,
      completedAt: status === 'Completed' ? new Date() : null,
    },
  });
}

export async function getOrderStats(req) {
  const [pending, inProgress, urgent, stat] = await Promise.all([
    prisma.clinicalOrder.count({ where: { tenantId: req.tenantId, status: 'Pending' } }),
    prisma.clinicalOrder.count({ where: { tenantId: req.tenantId, status: 'InProgress' } }),
    prisma.clinicalOrder.count({ where: { tenantId: req.tenantId, priority: 'Urgent', status: { in: ['Pending', 'InProgress'] } } }),
    prisma.clinicalOrder.count({ where: { tenantId: req.tenantId, priority: 'Stat', status: { in: ['Pending', 'InProgress'] } } }),
  ]);
  return { pending, inProgress, urgent, stat };
}

// ── PAYMENT SPLIT ─────────────────────────────────────────────────────────────

export async function addPaymentSplit(req, billId, splits) {
  const bill = await prisma.bill.findFirst({ where: { id: BigInt(billId), tenantId: req.tenantId } });
  if (!bill) throw ApiError.notFound('Bill not found');

  const totalSplit = splits.reduce((s, sp) => s + parseFloat(sp.amount), 0);

  const created = await prisma.paymentSplit.createMany({
    data: splits.map(sp => ({
      tenantId: req.tenantId,
      billId: BigInt(billId),
      method: sp.method,
      amount: parseFloat(sp.amount),
      reference: sp.reference || null,
      settledAt: sp.settledAt ? new Date(sp.settledAt) : new Date(),
    })),
  });

  return prisma.paymentSplit.findMany({
    where: { billId: BigInt(billId), tenantId: req.tenantId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getPaymentSplits(req, billId) {
  const splits = await prisma.paymentSplit.findMany({
    where: { billId: BigInt(billId), tenantId: req.tenantId },
    orderBy: { createdAt: 'asc' },
  });

  const total = splits.reduce((s, sp) => s + Number(sp.amount), 0);
  return { splits, total };
}

// ── BED STATUS HISTORY ────────────────────────────────────────────────────────

export async function recordBedStatusChange(req, bedId, toStatus, options = {}) {
  const bed = await prisma.bed.findFirst({ where: { id: BigInt(bedId), tenantId: req.tenantId } });
  if (!bed) throw ApiError.notFound('Bed not found');

  const fromStatus = bed.status;

  // Update bed status
  await prisma.bed.update({ where: { id: BigInt(bedId) }, data: { status: toStatus } });

  // Emit real-time
  emit.bedStatusChanged(req.tenantId, bedId, fromStatus, toStatus, bed?.room?.ward?.name);

  // Log the change
  return prisma.bedStatusHistory.create({
    data: {
      tenantId: req.tenantId,
      bedId: BigInt(bedId),
      patientId: options.patientId ? BigInt(options.patientId) : null,
      admissionId: options.admissionId ? BigInt(options.admissionId) : null,
      fromStatus,
      toStatus,
      changedBy: options.changedBy ? BigInt(options.changedBy) : null,
      notes: options.notes || null,
    },
  });
}

export async function getBedHistory(req, bedId) {
  return prisma.bedStatusHistory.findMany({
    where: { bedId: BigInt(bedId), tenantId: req.tenantId },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, uhid: true } },
    },
    orderBy: { changedAt: 'desc' },
    take: 50,
  });
}

export async function getLiveBedStatus(req) {
  const beds = await prisma.bed.findMany({
    where: { tenantId: req.tenantId },
    include: {
      room: { select: { id: true, roomNumber: true, ward: { select: { id: true, name: true } } } },
    },
    orderBy: [{ room: { ward: { name: 'asc' } } }, { bedNumber: 'asc' }],
  });

  const summary = beds.reduce((acc, bed) => {
    acc[bed.status] = (acc[bed.status] || 0) + 1;
    return acc;
  }, {});

  return { beds, summary, total: beds.length };
}

// ── ENHANCED AUDIT LOGGING ────────────────────────────────────────────────────

export async function writeAuditLog(req, {
  module, action, entityType, entityId,
  description, oldValue, newValue, severity = 'INFO',
}) {
  return prisma.auditLogExtended.create({
    data: {
      tenantId: req.tenantId,
      userId: req.user?.id ? BigInt(req.user.id) : null,
      userName: req.user?.name || req.user?.email || null,
      role: req.user?.role || null,
      module,
      action,
      entityType,
      entityId: String(entityId),
      description: description || null,
      oldValue: oldValue || null,
      newValue: newValue || null,
      ipAddress: req.ip || req.connection?.remoteAddress || null,
      userAgent: req.headers?.['user-agent']?.slice(0, 500) || null,
      sessionId: req.headers?.['x-session-id'] || null,
      severity,
    },
  });
}

export async function listAuditLogs(req, { page, limit, skip }, filters = {}) {
  const where = { tenantId: req.tenantId };
  if (filters.module) where.module = filters.module;
  if (filters.action) where.action = { contains: filters.action };
  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.userId) where.userId = BigInt(filters.userId);
  if (filters.severity) where.severity = filters.severity;
  if (filters.fromDate && filters.toDate) {
    where.createdAt = { gte: new Date(filters.fromDate), lte: new Date(filters.toDate) };
  }

  const [items, total] = await Promise.all([
    prisma.auditLogExtended.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLogExtended.count({ where }),
  ]);
  return { items, total, page, limit };
}
