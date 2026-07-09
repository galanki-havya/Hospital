import prisma from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { createCrudService } from './crudServiceFactory.js';
import { recordAudit } from './auditService.js';

export const labCategoryService = createCrudService('labCategory', { searchFields: ['categoryName'], moduleName: 'lab', entityLabel: 'Lab category', softDelete: false });

export const labTestService = createCrudService('labTest', {
  searchFields: ['testName', 'testCode'],
  moduleName: 'lab',
  entityLabel: 'Lab test',
  include: { category: { select: { id: true, categoryName: true } } },
});

const labOrderInclude = {
  patient: { select: { id: true, uhid: true, firstName: true, lastName: true } },
  doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
  items: { include: { test: true, result: true } },
};

function generateOrderNumber(prefix) {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${ymd}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function listLabOrders(req, { page, limit, skip, sortBy, sortDir }, filters = {}) {
  const where = { tenantId: req.tenantId, deletedAt: null };
  if (filters.status) where.status = filters.status;
  if (filters.patientId) where.patientId = BigInt(filters.patientId);

  const orderBy = { [sortBy === 'createdAt' ? 'orderDate' : sortBy]: sortDir };

  const [items, total] = await Promise.all([
    prisma.labOrder.findMany({ where, include: labOrderInclude, orderBy, skip, take: limit }),
    prisma.labOrder.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function getLabOrderById(req, id) {
  const order = await prisma.labOrder.findFirst({ where: { id: BigInt(id), tenantId: req.tenantId, deletedAt: null }, include: labOrderInclude });
  if (!order) throw ApiError.notFound('Lab order not found');
  return order;
}

export async function createLabOrder(req, data) {
  const patient = await prisma.patient.findFirst({ where: { id: BigInt(data.patientId), tenantId: req.tenantId, deletedAt: null } });
  if (!patient) throw ApiError.badRequest('Patient not found');

  const tests = await prisma.labTest.findMany({ where: { id: { in: data.testIds.map(BigInt) }, tenantId: req.tenantId } });
  if (tests.length !== data.testIds.length) throw ApiError.badRequest('One or more lab tests not found');

  const order = await prisma.labOrder.create({
    data: {
      tenantId: req.tenantId,
      patientId: BigInt(data.patientId),
      doctorId: data.doctorId ? BigInt(data.doctorId) : null,
      visitId: data.visitId ? BigInt(data.visitId) : null,
      orderNumber: generateOrderNumber('LAB'),
      priority: data.priority || 'Routine',
      status: 'Ordered',
      items: { create: tests.map((t) => ({ testId: t.id, price: t.price, status: 'Pending' })) },
    },
    include: labOrderInclude,
  });

  await recordAudit({ req, moduleName: 'lab', actionType: 'CREATE', entityName: 'lab_orders', entityId: order.id, newValues: data });
  return order;
}

export async function updateOrderItemStatus(req, orderId, itemId, status) {
  const item = await prisma.labOrderItem.findFirst({
    where: { id: BigInt(itemId), labOrderId: BigInt(orderId), labOrder: { tenantId: req.tenantId } },
  });
  if (!item) throw ApiError.notFound('Lab order item not found');

  const updated = await prisma.labOrderItem.update({ where: { id: BigInt(itemId) }, data: { status } });

  // roll up parent order status based on item statuses
  const allItems = await prisma.labOrderItem.findMany({ where: { labOrderId: BigInt(orderId) } });
  const allCompleted = allItems.every((i) => i.status === 'Completed');
  const anyCollected = allItems.some((i) => ['Collected', 'Processing', 'Completed'].includes(i.status));

  await prisma.labOrder.update({
    where: { id: BigInt(orderId) },
    data: { status: allCompleted ? 'Completed' : anyCollected ? 'Processing' : 'Ordered' },
  });

  return updated;
}

export async function submitResult(req, orderId, itemId, data) {
  const item = await prisma.labOrderItem.findFirst({
    where: { id: BigInt(itemId), labOrderId: BigInt(orderId), labOrder: { tenantId: req.tenantId } },
  });
  if (!item) throw ApiError.notFound('Lab order item not found');

  const result = await prisma.labResult.upsert({
    where: { labOrderItemId: BigInt(itemId) },
    update: { ...data, verifiedBy: req.user.id, verifiedAt: new Date() },
    create: { ...data, labOrderItemId: BigInt(itemId), verifiedBy: req.user.id, verifiedAt: new Date() },
  });

  await updateOrderItemStatus(req, orderId, itemId, 'Completed');

  const order = await prisma.labOrder.findUnique({ where: { id: BigInt(orderId) } });
  await prisma.notification
    .create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        title: 'Lab result available',
        message: `Result ready for order ${order.orderNumber}`,
        notificationType: 'Lab',
      },
    })
    .catch(() => {});

  return result;
}
