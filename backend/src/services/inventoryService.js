import prisma from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { createCrudService } from './crudServiceFactory.js';

export const inventoryCategoryService = createCrudService('inventoryCategory', {
  searchFields: ['name'],
  moduleName: 'inventory',
  entityLabel: 'Inventory Category',
  softDelete: false,
});

export const inventoryItemService = createCrudService('inventoryItem', {
  searchFields: ['name', 'itemCode'],
  moduleName: 'inventory',
  entityLabel: 'Inventory Item',
  include: { category: { select: { id: true, name: true } } },
  softDelete: false,
});

export async function listItems(req, { page, limit, skip, sortBy, sortDir, search }, filters = {}) {
  const where = { tenantId: req.tenantId, isActive: true };
  if (search) where.OR = [{ name: { contains: search } }, { itemCode: { contains: search } }];
  if (filters.categoryId) where.categoryId = BigInt(filters.categoryId);
  if (filters.lowStock === 'true') where.currentStock = { lte: prisma.inventoryItem.fields.minStockLevel };

  const [items, total] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      include: { category: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
      skip,
      take: limit,
    }),
    prisma.inventoryItem.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function getLowStockItems(req) {
  return prisma.$queryRaw`
    SELECT ii.*, ic.name as category_name 
    FROM inventory_items ii
    LEFT JOIN inventory_categories ic ON ii.category_id = ic.id
    WHERE ii.tenant_id = ${req.tenantId} AND ii.is_active = 1 
    AND ii.current_stock <= ii.min_stock_level
    ORDER BY (ii.current_stock - ii.min_stock_level) ASC
    LIMIT 50
  `;
}

export async function createPurchaseOrder(req, data) {
  const count = await prisma.purchaseOrder.count({ where: { tenantId: req.tenantId } });
  const poNumber = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

  let totalAmount = 0;
  const itemsData = (data.items || []).map((i) => {
    const total = parseFloat(i.orderedQty) * parseFloat(i.unitPrice);
    totalAmount += total;
    return {
      itemId: BigInt(i.itemId),
      orderedQty: i.orderedQty,
      receivedQty: 0,
      unitPrice: i.unitPrice,
      totalPrice: total,
    };
  });

  return prisma.purchaseOrder.create({
    data: {
      tenantId: req.tenantId,
      supplierId: data.supplierId ? BigInt(data.supplierId) : null,
      poNumber,
      orderDate: new Date(data.orderDate || Date.now()),
      expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
      totalAmount,
      notes: data.notes || null,
      items: { create: itemsData },
    },
    include: {
      supplier: { select: { id: true, supplierName: true } },
      items: { include: { item: { select: { id: true, name: true, unit: true } } } },
    },
  });
}

export async function receivePurchaseOrder(req, poId, data) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: BigInt(poId), tenantId: req.tenantId },
    include: { items: true },
  });
  if (!po) throw ApiError.notFound('Purchase Order not found');
  if (po.status === 'Cancelled') throw ApiError.badRequest('Cannot receive a cancelled order');

  for (const recv of data.items || []) {
    const poItem = po.items.find((i) => i.id === BigInt(recv.itemId));
    if (!poItem) continue;

    const newReceived = Number(poItem.receivedQty) + Number(recv.qty);
    await prisma.purchaseOrderItem.update({
      where: { id: poItem.id },
      data: { receivedQty: newReceived },
    });

    // update stock
    await prisma.inventoryItem.update({
      where: { id: poItem.itemId },
      data: { currentStock: { increment: Number(recv.qty) } },
    });

    await prisma.stockTransaction.create({
      data: {
        tenantId: req.tenantId,
        itemId: poItem.itemId,
        transactionType: 'Purchase',
        quantity: recv.qty,
        unitPrice: poItem.unitPrice,
        referenceType: 'PurchaseOrder',
        referenceId: po.id,
        createdBy: req.user?.id ? BigInt(req.user.id) : null,
      },
    });
  }

  // determine new PO status
  const updatedPO = await prisma.purchaseOrder.findFirst({
    where: { id: BigInt(poId) },
    include: { items: true },
  });
  const fullyReceived = updatedPO.items.every((i) => Number(i.receivedQty) >= Number(i.orderedQty));
  const partiallyReceived = updatedPO.items.some((i) => Number(i.receivedQty) > 0);

  await prisma.purchaseOrder.update({
    where: { id: BigInt(poId) },
    data: { status: fullyReceived ? 'Received' : partiallyReceived ? 'PartiallyReceived' : po.status },
  });

  return prisma.purchaseOrder.findFirst({
    where: { id: BigInt(poId) },
    include: {
      supplier: { select: { id: true, supplierName: true } },
      items: { include: { item: { select: { id: true, name: true, unit: true } } } },
    },
  });
}

export async function listPurchaseOrders(req, { page, limit, skip }, filters = {}) {
  const where = { tenantId: req.tenantId };
  if (filters.status) where.status = filters.status;
  if (filters.supplierId) where.supplierId = BigInt(filters.supplierId);

  const [items, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: { select: { id: true, supplierName: true } },
        items: { include: { item: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.purchaseOrder.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function getInventoryStats(req) {
  const [totalItems, lowStockCount, totalPOs, pendingPOs] = await Promise.all([
    prisma.inventoryItem.count({ where: { tenantId: req.tenantId, isActive: true } }),
    prisma.$queryRaw`SELECT COUNT(*) as c FROM inventory_items WHERE tenant_id = ${req.tenantId} AND is_active = 1 AND current_stock <= min_stock_level`,
    prisma.purchaseOrder.count({ where: { tenantId: req.tenantId } }),
    prisma.purchaseOrder.count({ where: { tenantId: req.tenantId, status: { in: ['Draft', 'Sent', 'PartiallyReceived'] } } }),
  ]);
  return { totalItems, lowStockCount: Number(lowStockCount[0]?.c || 0), totalPOs, pendingPOs };
}
