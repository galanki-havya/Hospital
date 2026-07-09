import prisma from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { recordAudit } from './auditService.js';

const EMP_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  employeeCode: true,
  department: { select: { id: true, name: true } },
};

export async function listEmployeeDocuments(req, { page, limit, skip }, filters = {}) {
  const where = { tenantId: req.tenantId };
  if (filters.employeeId) where.employeeId = BigInt(filters.employeeId);
  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;

  const [items, total] = await Promise.all([
    prisma.employeeDocument.findMany({
      where,
      include: { employee: { select: EMP_SELECT } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.employeeDocument.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function getEmployeeDocumentsForEmployee(req, employeeId) {
  const employee = await prisma.employee.findFirst({ where: { id: BigInt(employeeId), tenantId: req.tenantId } });
  if (!employee) throw ApiError.notFound('Employee not found');

  return prisma.employeeDocument.findMany({
    where: { tenantId: req.tenantId, employeeId: BigInt(employeeId) },
    include: { employee: { select: EMP_SELECT } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function uploadEmployeeDocument(req, data) {
  const employee = await prisma.employee.findFirst({ where: { id: BigInt(data.employeeId), tenantId: req.tenantId } });
  if (!employee) throw ApiError.notFound('Employee not found');

  const record = await prisma.employeeDocument.create({
    data: {
      tenantId: req.tenantId,
      employeeId: BigInt(data.employeeId),
      type: data.type,
      number: data.number || null,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      fileUrl: data.fileUrl || null,
      notes: data.notes || null,
      status: 'Pending',
    },
    include: { employee: { select: EMP_SELECT } },
  });

  await recordAudit({
    req,
    moduleName: 'hr',
    actionType: 'CREATE',
    entityName: 'employeeDocument',
    entityId: record.id,
    newValues: data,
  });

  return record;
}

export async function verifyEmployeeDocument(req, id) {
  const existing = await prisma.employeeDocument.findFirst({ where: { id: BigInt(id), tenantId: req.tenantId } });
  if (!existing) throw ApiError.notFound('Document not found');

  const record = await prisma.employeeDocument.update({
    where: { id: BigInt(id) },
    data: { status: 'Verified', verifiedBy: req.user?.id ?? null, verifiedAt: new Date() },
    include: { employee: { select: EMP_SELECT } },
  });

  await recordAudit({
    req,
    moduleName: 'hr',
    actionType: 'UPDATE',
    entityName: 'employeeDocument',
    entityId: record.id,
    oldValues: existing,
    newValues: { status: 'Verified' },
  });

  return record;
}

export async function deleteEmployeeDocument(req, id) {
  const existing = await prisma.employeeDocument.findFirst({ where: { id: BigInt(id), tenantId: req.tenantId } });
  if (!existing) throw ApiError.notFound('Document not found');

  await prisma.employeeDocument.delete({ where: { id: BigInt(id) } });

  await recordAudit({
    req,
    moduleName: 'hr',
    actionType: 'DELETE',
    entityName: 'employeeDocument',
    entityId: BigInt(id),
    oldValues: existing,
  });

  return { id };
}
