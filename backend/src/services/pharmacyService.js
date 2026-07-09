import prisma from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { createCrudService } from './crudServiceFactory.js';
import { recordAudit } from './auditService.js';

export const supplierService = createCrudService('supplier', { searchFields: ['supplierName', 'supplierCode'], moduleName: 'pharmacy', entityLabel: 'Supplier' });

export const medicineCategoryService = createCrudService('medicineCategory', {
  searchFields: ['categoryName'],
  moduleName: 'pharmacy',
  entityLabel: 'Medicine category',
  softDelete: false,
});

export const medicineService = createCrudService('medicine', {
  searchFields: ['medicineName', 'genericName', 'medicineCode'],
  moduleName: 'pharmacy',
  entityLabel: 'Medicine',
  include: { category: { select: { id: true, categoryName: true } } },
});

export async function listBatches(req, medicineId) {
  const medicine = await prisma.medicine.findFirst({ where: { id: BigInt(medicineId), tenantId: req.tenantId } });
  if (!medicine) throw ApiError.notFound('Medicine not found');
  return prisma.medicineBatch.findMany({
    where: { medicineId: BigInt(medicineId), availableQuantity: { gt: 0 } },
    include: { supplier: { select: { supplierName: true } } },
    orderBy: { expiryDate: 'asc' }, // FEFO: First-Expiry-First-Out
  });
}

export async function createBatch(req, medicineId, data) {
  const medicine = await prisma.medicine.findFirst({ where: { id: BigInt(medicineId), tenantId: req.tenantId } });
  if (!medicine) throw ApiError.notFound('Medicine not found');

  const batch = await prisma.medicineBatch.create({
    data: {
      medicineId: BigInt(medicineId),
      supplierId: data.supplierId ? BigInt(data.supplierId) : null,
      batchNumber: data.batchNumber,
      manufacturingDate: data.manufacturingDate || null,
      expiryDate: data.expiryDate,
      purchasePrice: data.purchasePrice ?? null,
      sellingPrice: data.sellingPrice,
      quantity: data.quantity,
      availableQuantity: data.quantity,
    },
  });

  await recordAudit({ req, moduleName: 'pharmacy', actionType: 'CREATE', entityName: 'medicine_batches', entityId: batch.id, newValues: data });
  return batch;
}

/** Low-stock + near-expiry alerts for the pharmacy dashboard. */
export async function getStockAlerts(req) {
  const medicines = await prisma.medicine.findMany({
    where: { tenantId: req.tenantId, isActive: true, deletedAt: null },
    include: { batches: { where: { availableQuantity: { gt: 0 } } } },
  });

  const lowStock = medicines
    .map((m) => ({ ...m, totalStock: m.batches.reduce((s, b) => s + b.availableQuantity, 0) }))
    .filter((m) => m.totalStock <= m.reorderLevel)
    .map(({ batches, ...rest }) => rest);

  const ninetyDaysFromNow = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  const expiringBatches = await prisma.medicineBatch.findMany({
    where: {
      medicine: { tenantId: req.tenantId },
      availableQuantity: { gt: 0 },
      expiryDate: { lte: ninetyDaysFromNow, gte: new Date() },
    },
    include: { medicine: { select: { medicineName: true } } },
    orderBy: { expiryDate: 'asc' },
    take: 20,
  });

  return { lowStock, expiringBatches };
}

function generateInvoiceNumber() {
  const date = new Date();
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `RX-${ymd}-${Math.floor(1000 + Math.random() * 9000)}`;
}

const saleInclude = {
  patient: { select: { id: true, uhid: true, firstName: true, lastName: true } },
  items: { include: { medicine: { select: { medicineName: true } }, batch: { select: { batchNumber: true, expiryDate: true } } } },
};

export async function listSales(req, { page, limit, skip, sortBy, sortDir }) {
  const where = { tenantId: req.tenantId, deletedAt: null };
  const orderBy = { [sortBy === 'createdAt' ? 'saleDate' : sortBy]: sortDir };
  const [items, total] = await Promise.all([
    prisma.pharmacySale.findMany({ where, include: saleInclude, orderBy, skip, take: limit }),
    prisma.pharmacySale.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function getSaleById(req, id) {
  const sale = await prisma.pharmacySale.findFirst({ where: { id: BigInt(id), tenantId: req.tenantId, deletedAt: null }, include: saleInclude });
  if (!sale) throw ApiError.notFound('Sale not found');
  return sale;
}

/**
 * Creates a pharmacy sale: validates batch stock, deducts it transactionally,
 * and computes totals server-side (never trusts client-sent totals).
 */
export async function createSale(req, data) {
  const sale = await prisma.$transaction(async (tx) => {
    let subtotal = 0;
    const itemsData = [];

    for (const item of data.items) {
      const batch = await tx.medicineBatch.findFirst({
        where: { id: BigInt(item.batchId), medicineId: BigInt(item.medicineId), medicine: { tenantId: req.tenantId } },
      });
      if (!batch) throw ApiError.badRequest(`Batch not found for medicine ${item.medicineId}`);
      if (batch.availableQuantity < item.quantity) {
        throw ApiError.conflict(`Insufficient stock for batch ${batch.batchNumber} (available: ${batch.availableQuantity})`);
      }

      const lineTotal = item.unitPrice * item.quantity - (item.discountAmount || 0);
      subtotal += lineTotal;

      itemsData.push({
        medicineId: BigInt(item.medicineId),
        batchId: BigInt(item.batchId),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount || 0,
        totalAmount: lineTotal,
      });

      await tx.medicineBatch.update({ where: { id: batch.id }, data: { availableQuantity: { decrement: item.quantity } } });
    }

    const discountAmount = data.discountAmount || 0;
    const taxAmount = data.taxAmount || 0;
    const netAmount = subtotal - discountAmount + taxAmount;

    return tx.pharmacySale.create({
      data: {
        tenantId: req.tenantId,
        patientId: data.patientId ? BigInt(data.patientId) : null,
        prescriptionId: data.prescriptionId ? BigInt(data.prescriptionId) : null,
        invoiceNumber: generateInvoiceNumber(),
        totalAmount: subtotal,
        discountAmount,
        taxAmount,
        netAmount,
        saleDate: new Date(),
        status: 'Completed',
        items: { create: itemsData },
      },
      include: saleInclude,
    });
  });

  await recordAudit({ req, moduleName: 'pharmacy', actionType: 'CREATE', entityName: 'pharmacy_sales', entityId: sale.id, newValues: data });
  return sale;
}
