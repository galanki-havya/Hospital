import prisma from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { recordAudit } from './auditService.js';

async function generateUhid(tenantId) {
  const year = new Date().getFullYear();
  const count = await prisma.patient.count({ where: { tenantId } });
  const sequence = String(count + 1).padStart(6, '0');
  const uhid = `UHID-${year}-${sequence}`;
  // guard against rare race collisions
  const exists = await prisma.patient.findUnique({ where: { uhid } });
  if (exists) return `UHID-${year}-${Date.now().toString().slice(-6)}`;
  return uhid;
}

export async function listPatients(req, { page, limit, skip, sortBy, sortDir, search }) {
  const where = { tenantId: req.tenantId, deletedAt: null };
  if (search) {
    where.OR = [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { phone: { contains: search } },
      { uhid: { contains: search } },
      { email: { contains: search } },
    ];
  }
  const [items, total] = await Promise.all([
    prisma.patient.findMany({ where, orderBy: { [sortBy]: sortDir }, skip, take: limit }),
    prisma.patient.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function getPatientById(req, id) {
  const patient = await prisma.patient.findFirst({
    where: { id: BigInt(id), tenantId: req.tenantId, deletedAt: null },
    include: {
      allergies: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
      medicalHistory: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!patient) throw ApiError.notFound('Patient not found');
  return patient;
}

export async function createPatient(req, data) {
  const uhid = await generateUhid(req.tenantId);
  const patient = await prisma.patient.create({ data: { ...data, tenantId: req.tenantId, uhid } });
  await recordAudit({ req, moduleName: 'patients', actionType: 'CREATE', entityName: 'patients', entityId: patient.id, newValues: data });
  return patient;
}

export async function updatePatient(req, id, data) {
  const existing = await prisma.patient.findFirst({ where: { id: BigInt(id), tenantId: req.tenantId, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Patient not found');
  const patient = await prisma.patient.update({ where: { id: BigInt(id) }, data });
  await recordAudit({ req, moduleName: 'patients', actionType: 'UPDATE', entityName: 'patients', entityId: patient.id, oldValues: existing, newValues: data });
  return patient;
}

export async function removePatient(req, id) {
  const existing = await prisma.patient.findFirst({ where: { id: BigInt(id), tenantId: req.tenantId, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Patient not found');
  await prisma.patient.update({ where: { id: BigInt(id) }, data: { deletedAt: new Date(), status: 'Inactive' } });
  await recordAudit({ req, moduleName: 'patients', actionType: 'DELETE', entityName: 'patients', entityId: BigInt(id), oldValues: existing });
  return { id };
}

export async function addAllergy(req, patientId, data) {
  await assertPatient(req, patientId);
  return prisma.patientAllergy.create({ data: { ...data, patientId: BigInt(patientId) } });
}

export async function removeAllergy(req, patientId, allergyId) {
  await assertPatient(req, patientId);
  const allergy = await prisma.patientAllergy.findFirst({ where: { id: BigInt(allergyId), patientId: BigInt(patientId) } });
  if (!allergy) throw ApiError.notFound('Allergy record not found');
  await prisma.patientAllergy.update({ where: { id: BigInt(allergyId) }, data: { deletedAt: new Date() } });
  return { id: allergyId };
}

export async function addMedicalHistory(req, patientId, data) {
  await assertPatient(req, patientId);
  return prisma.patientMedicalHistory.create({ data: { ...data, patientId: BigInt(patientId) } });
}

async function assertPatient(req, patientId) {
  const patient = await prisma.patient.findFirst({ where: { id: BigInt(patientId), tenantId: req.tenantId, deletedAt: null } });
  if (!patient) throw ApiError.notFound('Patient not found');
  return patient;
}

/** Full clinical timeline: visits, prescriptions, lab/radiology orders, admissions, bills. */
export async function getPatientTimeline(req, patientId) {
  await assertPatient(req, patientId);
  const id = BigInt(patientId);

  const [visits, admissions, labOrders, radiologyOrders, bills] = await Promise.all([
    prisma.visit.findMany({
      where: { patientId: id, deletedAt: null },
      include: { doctor: { include: { user: { select: { firstName: true, lastName: true } } } }, vitals: true, medicalRecord: true },
      orderBy: { visitDate: 'desc' },
      take: 20,
    }),
    prisma.admission.findMany({
      where: { patientId: id },
      include: { bed: { include: { room: { include: { ward: true } } } }, discharge: true },
      orderBy: { admittedAt: 'desc' },
      take: 10,
    }),
    prisma.labOrder.findMany({ where: { patientId: id }, include: { items: { include: { test: true, result: true } } }, orderBy: { orderDate: 'desc' }, take: 10 }),
    prisma.radiologyOrder.findMany({ where: { patientId: id }, include: { items: { include: { service: true } }, report: true }, orderBy: { orderedAt: 'desc' }, take: 10 }),
    prisma.bill.findMany({ where: { patientId: id }, orderBy: { billDate: 'desc' }, take: 10 }),
  ]);

  return { visits, admissions, labOrders, radiologyOrders, bills };
}
