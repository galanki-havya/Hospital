import prisma from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { recordAudit } from './auditService.js';

const visitInclude = {
  patient: { select: { id: true, uhid: true, firstName: true, lastName: true, gender: true, dob: true, bloodGroup: true } },
  doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
  vitals: { orderBy: { createdAt: 'desc' } },
  medicalRecord: true,
  clinicalNotes: { orderBy: { createdAt: 'desc' } },
  prescriptions: { include: { items: { include: { medicine: { select: { medicineName: true } } } } } },
};

export async function listVisits(req, { page, limit, skip, sortBy, sortDir }, filters = {}) {
  const where = { tenantId: req.tenantId, deletedAt: null };
  if (filters.patientId) where.patientId = BigInt(filters.patientId);
  if (filters.doctorId) where.doctorId = BigInt(filters.doctorId);
  if (filters.visitType) where.visitType = filters.visitType;

  const orderBy = { [sortBy === 'createdAt' ? 'visitDate' : sortBy]: sortDir };

  const [items, total] = await Promise.all([
    prisma.visit.findMany({ where, include: visitInclude, orderBy, skip, take: limit }),
    prisma.visit.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function getVisitById(req, id) {
  const visit = await prisma.visit.findFirst({ where: { id: BigInt(id), tenantId: req.tenantId, deletedAt: null }, include: visitInclude });
  if (!visit) throw ApiError.notFound('Visit not found');
  return visit;
}

export async function createVisit(req, data) {
  const [patient, doctor] = await Promise.all([
    prisma.patient.findFirst({ where: { id: BigInt(data.patientId), tenantId: req.tenantId, deletedAt: null } }),
    prisma.doctor.findFirst({ where: { id: BigInt(data.doctorId), tenantId: req.tenantId, deletedAt: null } }),
  ]);
  if (!patient) throw ApiError.badRequest('Patient not found');
  if (!doctor) throw ApiError.badRequest('Doctor not found');

  const visit = await prisma.visit.create({
    data: {
      tenantId: req.tenantId,
      patientId: BigInt(data.patientId),
      doctorId: BigInt(data.doctorId),
      appointmentId: data.appointmentId ? BigInt(data.appointmentId) : null,
      visitType: data.visitType,
      status: 'InProgress',
      visitDate: new Date(),
    },
    include: visitInclude,
  });

  if (data.appointmentId) {
    await prisma.appointment
      .update({ where: { id: BigInt(data.appointmentId) }, data: { status: 'Completed' } })
      .catch(() => {});
  }

  await recordAudit({ req, moduleName: 'visits', actionType: 'CREATE', entityName: 'visits', entityId: visit.id, newValues: data });
  return visit;
}

async function assertVisit(req, visitId) {
  const visit = await prisma.visit.findFirst({ where: { id: BigInt(visitId), tenantId: req.tenantId, deletedAt: null } });
  if (!visit) throw ApiError.notFound('Visit not found');
  return visit;
}

function calcBmi(heightCm, weightKg) {
  if (!heightCm || !weightKg) return null;
  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(2));
}

export async function recordVitals(req, visitId, data) {
  await assertVisit(req, visitId);
  const bmi = calcBmi(data.height, data.weight);
  return prisma.vitals.create({ data: { ...data, bmi, visitId: BigInt(visitId) } });
}

export async function upsertMedicalRecord(req, visitId, data) {
  await assertVisit(req, visitId);
  return prisma.medicalRecord.upsert({
    where: { visitId: BigInt(visitId) },
    update: data,
    create: { ...data, tenantId: req.tenantId, visitId: BigInt(visitId) },
  });
}

export async function addClinicalNote(req, visitId, data) {
  const visit = await assertVisit(req, visitId);
  return prisma.clinicalNote.create({ data: { notes: data.notes, visitId: BigInt(visitId), doctorId: visit.doctorId } });
}

export async function createPrescription(req, visitId, data) {
  const visit = await assertVisit(req, visitId);

  const prescription = await prisma.prescription.create({
    data: {
      tenantId: req.tenantId,
      visitId: BigInt(visitId),
      patientId: visit.patientId,
      doctorId: visit.doctorId,
      instructions: data.instructions || null,
      items: {
        create: data.items.map((item) => ({
          medicineId: item.medicineId ? BigInt(item.medicineId) : null,
          medicineName: item.medicineName,
          dosage: item.dosage || null,
          frequency: item.frequency || null,
          durationDays: item.durationDays ?? null,
          instructions: item.instructions || null,
        })),
      },
    },
    include: { items: true },
  });

  await recordAudit({ req, moduleName: 'visits', actionType: 'CREATE', entityName: 'prescriptions', entityId: prescription.id, newValues: data });

  await prisma.notification
    .create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        title: 'Prescription created',
        message: `Prescription #${prescription.id} created with ${data.items.length} item(s)`,
        notificationType: 'System',
      },
    })
    .catch(() => {});

  return prescription;
}

export async function completeVisit(req, visitId) {
  await assertVisit(req, visitId);
  return prisma.visit.update({ where: { id: BigInt(visitId) }, data: { status: 'Completed' } });
}
