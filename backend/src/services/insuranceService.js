import prisma from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { createCrudService } from './crudServiceFactory.js';

export const insurancePayerService = createCrudService('insurancePayer', {
  searchFields: ['name', 'code'],
  moduleName: 'insurance',
  entityLabel: 'Insurance Payer',
  softDelete: false,
});

const claimInclude = {
  payer: { select: { id: true, name: true, code: true, type: true } },
  patient: { select: { id: true, firstName: true, lastName: true, uhid: true } },
};

export async function listClaims(req, { page, limit, skip, sortBy, sortDir }, filters = {}) {
  const where = { tenantId: req.tenantId };
  if (filters.status) where.status = filters.status;
  if (filters.payerId) where.payerId = BigInt(filters.payerId);
  if (filters.patientId) where.patientId = BigInt(filters.patientId);

  const [items, total] = await Promise.all([
    prisma.insuranceClaim.findMany({ where, include: claimInclude, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    prisma.insuranceClaim.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function createClaim(req, data) {
  const payer = await prisma.insurancePayer.findFirst({ where: { id: BigInt(data.payerId), tenantId: req.tenantId } });
  if (!payer) throw ApiError.notFound('Insurance payer not found');

  const patient = await prisma.patient.findFirst({ where: { id: BigInt(data.patientId), tenantId: req.tenantId } });
  if (!patient) throw ApiError.notFound('Patient not found');

  const count = await prisma.insuranceClaim.count({ where: { tenantId: req.tenantId } });
  const claimNumber = `CLM-${String(count + 1).padStart(6, '0')}`;

  return prisma.insuranceClaim.create({
    data: {
      tenantId: req.tenantId,
      payerId: BigInt(data.payerId),
      patientId: BigInt(data.patientId),
      billId: data.billId ? BigInt(data.billId) : null,
      admissionId: data.admissionId ? BigInt(data.admissionId) : null,
      claimNumber,
      policyNumber: data.policyNumber || null,
      policyHolder: data.policyHolder || null,
      claimedAmount: data.claimedAmount,
      notes: data.notes || null,
    },
    include: claimInclude,
  });
}

export async function updateClaimStatus(req, id, data) {
  const claim = await prisma.insuranceClaim.findFirst({ where: { id: BigInt(id), tenantId: req.tenantId } });
  if (!claim) throw ApiError.notFound('Claim not found');

  const updateData = { status: data.status };
  if (data.approvedAmount !== undefined) updateData.approvedAmount = data.approvedAmount;
  if (data.settledAmount !== undefined) updateData.settledAmount = data.settledAmount;
  if (data.rejectionReason) updateData.rejectionReason = data.rejectionReason;
  if (data.status === 'Submitted') updateData.submittedAt = new Date();
  if (['Settled', 'PartiallyApproved'].includes(data.status)) updateData.settledAt = new Date();

  return prisma.insuranceClaim.update({ where: { id: BigInt(id) }, data: updateData, include: claimInclude });
}

export async function getClaimStats(req) {
  const [total, pending, approved, rejected, claimed, settled] = await Promise.all([
    prisma.insuranceClaim.count({ where: { tenantId: req.tenantId } }),
    prisma.insuranceClaim.count({ where: { tenantId: req.tenantId, status: { in: ['Draft', 'Submitted', 'UnderReview'] } } }),
    prisma.insuranceClaim.count({ where: { tenantId: req.tenantId, status: 'Approved' } }),
    prisma.insuranceClaim.count({ where: { tenantId: req.tenantId, status: 'Rejected' } }),
    prisma.insuranceClaim.aggregate({ where: { tenantId: req.tenantId }, _sum: { claimedAmount: true } }),
    prisma.insuranceClaim.aggregate({ where: { tenantId: req.tenantId }, _sum: { settledAmount: true } }),
  ]);
  return { total, pending, approved, rejected, totalClaimed: claimed._sum.claimedAmount || 0, totalSettled: settled._sum.settledAmount || 0 };
}
