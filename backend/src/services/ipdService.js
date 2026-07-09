import prisma from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { createCrudService } from './crudServiceFactory.js';
import { recordAudit } from './auditService.js';

export const wardService = createCrudService('ward', { searchFields: ['name'], moduleName: 'ipd', entityLabel: 'Ward' });

export const roomService = createCrudService('room', {
  searchFields: ['roomNumber'],
  moduleName: 'ipd',
  entityLabel: 'Room',
  include: { ward: { select: { id: true, name: true, wardType: true } } },
});

export const bedService = createCrudService('bed', {
  searchFields: ['bedNumber'],
  moduleName: 'ipd',
  entityLabel: 'Bed',
  softDelete: false,
  include: { room: { include: { ward: { select: { id: true, name: true } } } } },
});

const admissionInclude = {
  patient: { select: { id: true, uhid: true, firstName: true, lastName: true, gender: true, bloodGroup: true } },
  bed: { include: { room: { include: { ward: true } } } },
  admittingDoctor: { include: { user: { select: { firstName: true, lastName: true } } } },
  discharge: true,
};

export async function listAdmissions(req, { page, limit, skip, sortBy, sortDir }, filters = {}) {
  const where = { tenantId: req.tenantId, deletedAt: null };
  if (filters.status) where.status = filters.status;
  if (filters.patientId) where.patientId = BigInt(filters.patientId);

  const orderBy = { [sortBy === 'createdAt' ? 'admittedAt' : sortBy]: sortDir };

  const [items, total] = await Promise.all([
    prisma.admission.findMany({ where, include: admissionInclude, orderBy, skip, take: limit }),
    prisma.admission.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function getAdmissionById(req, id) {
  const admission = await prisma.admission.findFirst({ where: { id: BigInt(id), tenantId: req.tenantId, deletedAt: null }, include: admissionInclude });
  if (!admission) throw ApiError.notFound('Admission not found');
  return admission;
}

export async function admitPatient(req, data) {
  const [patient, bed] = await Promise.all([
    prisma.patient.findFirst({ where: { id: BigInt(data.patientId), tenantId: req.tenantId, deletedAt: null } }),
    prisma.bed.findFirst({ where: { id: BigInt(data.bedId), tenantId: req.tenantId } }),
  ]);
  if (!patient) throw ApiError.badRequest('Patient not found');
  if (!bed) throw ApiError.badRequest('Bed not found');
  if (bed.status !== 'Available') throw ApiError.conflict('Selected bed is not available');

  const admission = await prisma.$transaction(async (tx) => {
    // Atomically claim the bed: this UPDATE...WHERE only succeeds if the bed is
    // still Available at the moment of the write, so two concurrent admissions
    // for the same bed can't both succeed (the second will get count: 0).
    const claim = await tx.bed.updateMany({
      where: { id: BigInt(data.bedId), tenantId: req.tenantId, status: 'Available' },
      data: { status: 'Occupied' },
    });
    if (claim.count === 0) throw ApiError.conflict('Selected bed is not available');

    const created = await tx.admission.create({
      data: {
        tenantId: req.tenantId,
        patientId: BigInt(data.patientId),
        visitId: data.visitId ? BigInt(data.visitId) : null,
        bedId: BigInt(data.bedId),
        admittingDoctorId: data.admittingDoctorId ? BigInt(data.admittingDoctorId) : null,
        admissionReason: data.admissionReason || null,
        expectedDischargeDate: data.expectedDischargeDate || null,
        status: 'Admitted',
      },
      include: admissionInclude,
    });

    await tx.room.update({ where: { id: bed.roomId }, data: { status: 'Occupied' } }).catch(() => {});

    return created;
  });

  await recordAudit({ req, moduleName: 'ipd', actionType: 'CREATE', entityName: 'admissions', entityId: admission.id, newValues: data });
  return admission;
}

export async function transferBed(req, admissionId, data) {
  const admission = await prisma.admission.findFirst({ where: { id: BigInt(admissionId), tenantId: req.tenantId, status: 'Admitted' } });
  if (!admission) throw ApiError.notFound('Active admission not found');

  const toBed = await prisma.bed.findFirst({ where: { id: BigInt(data.toBedId), tenantId: req.tenantId } });
  if (!toBed) throw ApiError.badRequest('Target bed not found');
  if (toBed.status !== 'Available') throw ApiError.conflict('Target bed is not available');

  const fromBedId = admission.bedId;

  const updated = await prisma.$transaction(async (tx) => {
    // Note: bed_transfers history table is out of scope for this build;
    // the move itself is still tracked via the audit_logs entry below.
    const claim = await tx.bed.updateMany({
      where: { id: toBed.id, tenantId: req.tenantId, status: 'Available' },
      data: { status: 'Occupied' },
    });
    if (claim.count === 0) throw ApiError.conflict('Target bed is not available');

    await tx.bed.update({ where: { id: fromBedId }, data: { status: 'Available' } });

    return tx.admission.update({ where: { id: admission.id }, data: { bedId: toBed.id }, include: admissionInclude });
  });

  await recordAudit({ req, moduleName: 'ipd', actionType: 'UPDATE', entityName: 'admissions', entityId: admission.id, oldValues: { bedId: fromBedId }, newValues: { bedId: toBed.id } });
  return updated;
}

export async function dischargePatient(req, admissionId, data) {
  const admission = await prisma.admission.findFirst({ where: { id: BigInt(admissionId), tenantId: req.tenantId, status: 'Admitted' }, include: { bed: true } });
  if (!admission) throw ApiError.notFound('Active admission not found');

  const result = await prisma.$transaction(async (tx) => {
    const discharge = await tx.discharge.create({
      data: {
        admissionId: admission.id,
        dischargeSummary: data.dischargeSummary || null,
        followupDate: data.followupDate || null,
        dischargeDate: new Date(),
      },
    });

    const updatedAdmission = await tx.admission.update({
      where: { id: admission.id },
      data: { status: 'Discharged' },
      include: admissionInclude,
    });

    await tx.bed.update({ where: { id: admission.bedId }, data: { status: 'Available' } });
    await tx.room.update({ where: { id: admission.bed.roomId }, data: { status: 'Available' } }).catch(() => {});

    return { discharge, admission: updatedAdmission };
  });

  await recordAudit({ req, moduleName: 'ipd', actionType: 'UPDATE', entityName: 'admissions', entityId: admission.id, newValues: { status: 'Discharged' } });
  return result;
}

/** Aggregate bed occupancy stats for dashboard / ward management view. */
export async function getBedOccupancySummary(req) {
  const beds = await prisma.bed.findMany({ where: { tenantId: req.tenantId }, select: { status: true } });
  const total = beds.length;
  const occupied = beds.filter((b) => b.status === 'Occupied').length;
  const available = beds.filter((b) => b.status === 'Available').length;
  const maintenance = beds.filter((b) => b.status === 'Maintenance').length;
  const reserved = beds.filter((b) => b.status === 'Reserved').length;
  return {
    total,
    occupied,
    available,
    maintenance,
    reserved,
    occupancyRate: total ? Number(((occupied / total) * 100).toFixed(1)) : 0,
  };
}
