import prisma from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { createCrudService } from './crudServiceFactory.js';
import { recordAudit } from './auditService.js';

export const radiologyServiceCrud = createCrudService('radiologyService', {
  searchFields: ['serviceName', 'serviceCode'],
  moduleName: 'radiology',
  entityLabel: 'Radiology service',
});

function generateOrderNumber() {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `RAD-${ymd}-${Math.floor(1000 + Math.random() * 9000)}`;
}

const orderInclude = {
  patient: { select: { id: true, uhid: true, firstName: true, lastName: true } },
  doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
  items: { include: { service: true } },
  report: true,
};

export async function listOrders(req, { page, limit, skip, sortBy, sortDir }, filters = {}) {
  const where = { tenantId: req.tenantId, deletedAt: null };
  if (filters.status) where.status = filters.status;
  if (filters.patientId) where.patientId = BigInt(filters.patientId);
  const [items, total] = await Promise.all([
    prisma.radiologyOrder.findMany({ where, include: orderInclude, orderBy: { [sortBy === 'createdAt' ? 'orderedAt' : sortBy]: sortDir }, skip, take: limit }),
    prisma.radiologyOrder.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function getOrderById(req, id) {
  const order = await prisma.radiologyOrder.findFirst({ where: { id: BigInt(id), tenantId: req.tenantId, deletedAt: null }, include: orderInclude });
  if (!order) throw ApiError.notFound('Radiology order not found');
  return order;
}

export async function createOrder(req, data) {
  const patient = await prisma.patient.findFirst({ where: { id: BigInt(data.patientId), tenantId: req.tenantId, deletedAt: null } });
  if (!patient) throw ApiError.badRequest('Patient not found');

  const services = await prisma.radiologyService.findMany({ where: { id: { in: data.serviceIds.map(BigInt) }, tenantId: req.tenantId } });
  if (services.length !== data.serviceIds.length) throw ApiError.badRequest('One or more radiology services not found');

  const order = await prisma.radiologyOrder.create({
    data: {
      tenantId: req.tenantId,
      patientId: BigInt(data.patientId),
      doctorId: data.doctorId ? BigInt(data.doctorId) : null,
      visitId: data.visitId ? BigInt(data.visitId) : null,
      orderNumber: generateOrderNumber(),
      status: 'Ordered',
      items: { create: services.map((s) => ({ serviceId: s.id, price: s.price, status: 'Pending' })) },
    },
    include: orderInclude,
  });
  await recordAudit({ req, moduleName: 'radiology', actionType: 'CREATE', entityName: 'radiology_orders', entityId: order.id, newValues: data });
  return order;
}

export async function updateOrderStatus(req, id, status) {
  const existing = await prisma.radiologyOrder.findFirst({ where: { id: BigInt(id), tenantId: req.tenantId } });
  if (!existing) throw ApiError.notFound('Radiology order not found');
  return prisma.radiologyOrder.update({ where: { id: BigInt(id) }, data: { status }, include: orderInclude });
}

export async function upsertReport(req, orderId, data) {
  const order = await prisma.radiologyOrder.findFirst({ where: { id: BigInt(orderId), tenantId: req.tenantId } });
  if (!order) throw ApiError.notFound('Radiology order not found');
  return prisma.radiologyReport.upsert({
    where: { radiologyOrderId: BigInt(orderId) },
    update: { ...data, reportedBy: req.user.id, reportedAt: new Date() },
    create: { radiologyOrderId: BigInt(orderId), ...data, reportedBy: req.user.id, reportedAt: new Date() },
  });
}
