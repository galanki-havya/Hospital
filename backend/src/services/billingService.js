import prisma from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { createCrudService } from './crudServiceFactory.js';
import { recordAudit } from './auditService.js';

export const billingCategoryService = createCrudService('billingCategory', {
  searchFields: ['categoryName'],
  moduleName: 'billing',
  entityLabel: 'Billing category',
  softDelete: false,
});

function generateBillNumber() {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `BILL-${ymd}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function calcTotals(items, discountAmount = 0, taxAmount = 0) {
  const itemizedTotal = items.reduce((sum, item) => {
    const lineTotal = item.unitPrice * (item.quantity ?? 1) - (item.discountAmount ?? 0) + (item.taxAmount ?? 0);
    return sum + lineTotal;
  }, 0);
  const totalAmount = itemizedTotal - discountAmount + taxAmount;
  return { subtotal: itemizedTotal, totalAmount, dueAmount: totalAmount };
}

const billInclude = {
  patient: { select: { id: true, uhid: true, firstName: true, lastName: true, phone: true } },
  items: { include: { category: { select: { categoryName: true } } } },
  payments: { orderBy: { paymentDate: 'desc' } },
};

export async function listBills(req, { page, limit, skip, sortBy, sortDir }, filters = {}) {
  const where = { tenantId: req.tenantId, deletedAt: null };
  if (filters.status) where.status = filters.status;
  if (filters.patientId) where.patientId = BigInt(filters.patientId);

  const orderBy = { [sortBy === 'createdAt' ? 'billDate' : sortBy]: sortDir };
  const [items, total] = await Promise.all([
    prisma.bill.findMany({ where, include: billInclude, orderBy, skip, take: limit }),
    prisma.bill.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function getBillById(req, id) {
  const bill = await prisma.bill.findFirst({ where: { id: BigInt(id), tenantId: req.tenantId, deletedAt: null }, include: billInclude });
  if (!bill) throw ApiError.notFound('Bill not found');
  return bill;
}

export async function createBill(req, data) {
  const patient = await prisma.patient.findFirst({ where: { id: BigInt(data.patientId), tenantId: req.tenantId, deletedAt: null } });
  if (!patient) throw ApiError.badRequest('Patient not found');

  const { subtotal, totalAmount, dueAmount } = calcTotals(data.items, data.discountAmount, data.taxAmount);

  const bill = await prisma.bill.create({
    data: {
      tenantId: req.tenantId,
      patientId: BigInt(data.patientId),
      billNumber: generateBillNumber(),
      subtotal,
      discountAmount: data.discountAmount ?? 0,
      taxAmount: data.taxAmount ?? 0,
      totalAmount,
      paidAmount: 0,
      dueAmount,
      status: 'Draft',
      items: {
        create: data.items.map((item) => ({
          categoryId: item.categoryId ? BigInt(item.categoryId) : null,
          serviceName: item.serviceName,
          quantity: item.quantity ?? 1,
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount ?? 0,
          taxAmount: item.taxAmount ?? 0,
          totalAmount: item.unitPrice * (item.quantity ?? 1) - (item.discountAmount ?? 0) + (item.taxAmount ?? 0),
        })),
      },
    },
    include: billInclude,
  });

  await recordAudit({ req, moduleName: 'billing', actionType: 'CREATE', entityName: 'bills', entityId: bill.id, newValues: data });
  return bill;
}

export async function addBillItem(req, billId, itemData) {
  const bill = await prisma.bill.findFirst({ where: { id: BigInt(billId), tenantId: req.tenantId, deletedAt: null } });
  if (!bill) throw ApiError.notFound('Bill not found');
  if (bill.status === 'Paid') throw ApiError.conflict('Cannot modify a paid bill');

  const lineTotal = itemData.unitPrice * (itemData.quantity ?? 1) - (itemData.discountAmount ?? 0) + (itemData.taxAmount ?? 0);

  const newItem = await prisma.billItem.create({
    data: {
      billId: BigInt(billId),
      categoryId: itemData.categoryId ? BigInt(itemData.categoryId) : null,
      serviceName: itemData.serviceName,
      quantity: itemData.quantity ?? 1,
      unitPrice: itemData.unitPrice,
      discountAmount: itemData.discountAmount ?? 0,
      taxAmount: itemData.taxAmount ?? 0,
      totalAmount: lineTotal,
    },
  });

  // recalculate bill totals
  await recomputeBillTotals(billId);
  return newItem;
}

async function recomputeBillTotals(billId) {
  const items = await prisma.billItem.findMany({ where: { billId: BigInt(billId) } });
  const subtotal = items.reduce((s, i) => s + Number(i.totalAmount), 0);
  const bill = await prisma.bill.findUnique({ where: { id: BigInt(billId) } });
  const totalAmount = subtotal - Number(bill.discountAmount) + Number(bill.taxAmount);
  const dueAmount = Math.max(0, totalAmount - Number(bill.paidAmount));
  await prisma.bill.update({ where: { id: BigInt(billId) }, data: { subtotal, totalAmount, dueAmount } });
}

export async function recordPayment(req, billId, data) {
  const bill = await prisma.bill.findFirst({ where: { id: BigInt(billId), tenantId: req.tenantId, deletedAt: null } });
  if (!bill) throw ApiError.notFound('Bill not found');
  if (bill.status === 'Cancelled') throw ApiError.conflict('Cannot accept payment for a cancelled bill');

  if (Number(data.amount) > Number(bill.dueAmount) + 0.01) {
    throw ApiError.badRequest(`Payment amount (${data.amount}) exceeds due amount (${bill.dueAmount})`);
  }

  const payment = await prisma.$transaction(async (tx) => {
    const pmt = await tx.payment.create({
      data: {
        tenantId: req.tenantId,
        billId: BigInt(billId),
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        transactionId: data.transactionId || null,
        paymentReference: data.paymentReference || null,
        paymentDate: new Date(),
        status: 'Success',
      },
    });

    const newPaid = Number(bill.paidAmount) + Number(data.amount);
    const newDue = Math.max(0, Number(bill.totalAmount) - newPaid);
    const newStatus = newDue <= 0.01 ? 'Paid' : newPaid > 0 ? 'PartiallyPaid' : bill.status;

    await tx.bill.update({ where: { id: BigInt(billId) }, data: { paidAmount: newPaid, dueAmount: newDue, status: newStatus } });
    return pmt;
  });

  await recordAudit({ req, moduleName: 'billing', actionType: 'CREATE', entityName: 'payments', entityId: payment.id, newValues: data });
  return { payment, bill: await getBillById(req, billId) };
}

export async function getRevenueStats(req) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [todayRevenue, monthRevenue, totalRevenue, billsByStatus, recentPayments] = await Promise.all([
    prisma.payment.aggregate({ where: { tenantId: req.tenantId, status: 'Success', paymentDate: { gte: todayStart } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { tenantId: req.tenantId, status: 'Success', paymentDate: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { tenantId: req.tenantId, status: 'Success' }, _sum: { amount: true } }),
    prisma.bill.groupBy({ by: ['status'], where: { tenantId: req.tenantId, deletedAt: null }, _count: { id: true }, _sum: { totalAmount: true } }),
    prisma.payment.findMany({ where: { tenantId: req.tenantId, status: 'Success' }, include: { bill: { include: { patient: { select: { firstName: true, lastName: true } } } } }, orderBy: { paymentDate: 'desc' }, take: 5 }),
  ]);

  return {
    todayRevenue: Number(todayRevenue._sum.amount ?? 0),
    monthRevenue: Number(monthRevenue._sum.amount ?? 0),
    totalRevenue: Number(totalRevenue._sum.amount ?? 0),
    billsByStatus: billsByStatus.map((b) => ({ status: b.status, count: b._count.id, total: Number(b._sum.totalAmount ?? 0) })),
    recentPayments,
  };
}
