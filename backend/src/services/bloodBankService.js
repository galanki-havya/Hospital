import prisma from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { createCrudService } from './crudServiceFactory.js';

export const bloodDonorService = createCrudService('bloodDonor', {
  searchFields: ['name', 'donorCode', 'phone'],
  moduleName: 'blood_bank',
  entityLabel: 'Blood Donor',
  softDelete: false,
});

export async function listBloodUnits(req, { page, limit, skip }, filters = {}) {
  const where = { tenantId: req.tenantId };
  if (filters.bloodGroup) where.bloodGroup = filters.bloodGroup;
  if (filters.status) where.status = filters.status;
  if (filters.componentType) where.componentType = { contains: filters.componentType };

  const [items, total] = await Promise.all([
    prisma.bloodUnit.findMany({
      where,
      include: { donor: { select: { id: true, name: true, donorCode: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.bloodUnit.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function addBloodUnit(req, data) {
  if (data.donorId) {
    const donor = await prisma.bloodDonor.findFirst({ where: { id: BigInt(data.donorId), tenantId: req.tenantId } });
    if (!donor) throw ApiError.notFound('Donor not found');
  }

  const count = await prisma.bloodUnit.count({ where: { tenantId: req.tenantId } });
  const unitCode = `BU-${String(count + 1).padStart(6, '0')}`;

  const unit = await prisma.bloodUnit.create({
    data: {
      tenantId: req.tenantId,
      donorId: data.donorId ? BigInt(data.donorId) : null,
      unitCode,
      bloodGroup: data.bloodGroup,
      componentType: data.componentType,
      volumeMl: parseInt(data.volumeMl),
      collectedAt: new Date(data.collectedAt),
      expiresAt: new Date(data.expiresAt),
      status: 'Available',
      notes: data.notes || null,
    },
    include: { donor: { select: { id: true, name: true } } },
  });

  if (data.donorId) {
    await prisma.bloodDonor.update({
      where: { id: BigInt(data.donorId) },
      data: { lastDonatedAt: new Date(data.collectedAt), totalDonations: { increment: 1 } },
    });
  }

  return unit;
}

export async function issueBloodUnit(req, unitId, patientId) {
  const unit = await prisma.bloodUnit.findFirst({ where: { id: BigInt(unitId), tenantId: req.tenantId } });
  if (!unit) throw ApiError.notFound('Blood unit not found');
  if (unit.status !== 'Available') throw ApiError.badRequest(`Unit is ${unit.status} and cannot be issued`);

  return prisma.bloodUnit.update({
    where: { id: BigInt(unitId) },
    data: { status: 'Issued', issuedTo: BigInt(patientId), issuedAt: new Date() },
  });
}

export async function getBloodBankStats(req) {
  const groups = ['APositive', 'ANegative', 'BPositive', 'BNegative', 'ABPositive', 'ABNegative', 'OPositive', 'ONegative'];
  const stocks = {};
  for (const g of groups) {
    stocks[g] = await prisma.bloodUnit.count({ where: { tenantId: req.tenantId, bloodGroup: g, status: 'Available' } });
  }

  const [totalDonors, totalUnits, issuedToday] = await Promise.all([
    prisma.bloodDonor.count({ where: { tenantId: req.tenantId, status: 'Active' } }),
    prisma.bloodUnit.count({ where: { tenantId: req.tenantId, status: 'Available' } }),
    prisma.bloodUnit.count({
      where: {
        tenantId: req.tenantId,
        status: 'Issued',
        issuedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
  ]);

  return { stocks, totalDonors, totalUnits, issuedToday };
}
