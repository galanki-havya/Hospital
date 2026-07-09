import prisma from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { recordAudit } from './auditService.js';

const appointmentInclude = {
  patient: { select: { id: true, uhid: true, firstName: true, lastName: true, phone: true } },
  doctor: { include: { user: { select: { firstName: true, lastName: true } }, department: { select: { name: true } } } },
};

function dayBounds(dateInput) {
  const d = new Date(dateInput);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { start, end };
}

export async function listAppointments(req, { page, limit, skip, sortBy, sortDir }, filters = {}) {
  const where = { tenantId: req.tenantId, deletedAt: null };
  if (filters.doctorId) where.doctorId = BigInt(filters.doctorId);
  if (filters.patientId) where.patientId = BigInt(filters.patientId);
  if (filters.status) where.status = filters.status;
  if (filters.date) {
    const { start, end } = dayBounds(filters.date);
    where.appointmentTime = { gte: start, lte: end };
  }

  const orderBy = { [sortBy === 'createdAt' ? 'appointmentTime' : sortBy]: sortDir };

  const [items, total] = await Promise.all([
    prisma.appointment.findMany({ where, include: appointmentInclude, orderBy, skip, take: limit }),
    prisma.appointment.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function getAppointmentById(req, id) {
  const appt = await prisma.appointment.findFirst({
    where: { id: BigInt(id), tenantId: req.tenantId, deletedAt: null },
    include: appointmentInclude,
  });
  if (!appt) throw ApiError.notFound('Appointment not found');
  return appt;
}

/** Generates the next token number for a doctor on a given calendar day. */
async function nextTokenNumber(tenantId, doctorId, appointmentTime, client = prisma) {
  const { start, end } = dayBounds(appointmentTime);
  const count = await client.appointment.count({
    where: { tenantId, doctorId: BigInt(doctorId), appointmentTime: { gte: start, lte: end }, deletedAt: null },
  });
  return count + 1;
}

export async function createAppointment(req, data) {
  const [patient, doctor] = await Promise.all([
    prisma.patient.findFirst({ where: { id: BigInt(data.patientId), tenantId: req.tenantId, deletedAt: null } }),
    prisma.doctor.findFirst({ where: { id: BigInt(data.doctorId), tenantId: req.tenantId, deletedAt: null } }),
  ]);
  if (!patient) throw ApiError.badRequest('Patient not found');
  if (!doctor) throw ApiError.badRequest('Doctor not found');

  // Token numbers are assigned via count-then-insert, which under concurrent
  // requests for the same doctor/day could otherwise race to the same number.
  // Serializable isolation makes Postgres detect that conflict and abort one
  // of the transactions; we retry it once with a freshly recomputed count.
  let appointment;
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      appointment = await prisma.$transaction(
        async (tx) => {
          const tokenNumber = await nextTokenNumber(req.tenantId, data.doctorId, data.appointmentTime, tx);
          return tx.appointment.create({
            data: {
              tenantId: req.tenantId,
              patientId: BigInt(data.patientId),
              doctorId: BigInt(data.doctorId),
              appointmentTime: new Date(data.appointmentTime),
              reason: data.reason || null,
              tokenNumber,
              status: 'Scheduled',
            },
            include: appointmentInclude,
          });
        },
        { isolationLevel: 'Serializable' }
      );
      break;
    } catch (err) {
      const isSerializationConflict = err?.code === 'P2034';
      if (isSerializationConflict && attempt < maxAttempts) continue;
      throw err;
    }
  }

  await recordAudit({ req, moduleName: 'appointments', actionType: 'CREATE', entityName: 'appointments', entityId: appointment.id, newValues: data });

  // best-effort notification for the doctor's linked user account
  await prisma.notification
    .create({
      data: {
        tenantId: req.tenantId,
        userId: doctor.userId,
        title: 'New appointment scheduled',
        message: `Token #${appointment.tokenNumber} - ${patient.firstName} ${patient.lastName || ''} at ${new Date(data.appointmentTime).toLocaleString()}`,
        notificationType: 'Appointment',
      },
    })
    .catch(() => {});

  return appointment;
}

export async function updateAppointment(req, id, data) {
  const existing = await prisma.appointment.findFirst({ where: { id: BigInt(id), tenantId: req.tenantId, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Appointment not found');

  const appointment = await prisma.appointment.update({
    where: { id: BigInt(id) },
    data: { ...data, appointmentTime: data.appointmentTime ? new Date(data.appointmentTime) : undefined },
    include: appointmentInclude,
  });

  await recordAudit({ req, moduleName: 'appointments', actionType: 'UPDATE', entityName: 'appointments', entityId: appointment.id, oldValues: existing, newValues: data });
  return appointment;
}

export async function cancelAppointment(req, id) {
  return updateAppointment(req, id, { status: 'Cancelled' });
}

export async function checkIn(req, id) {
  return updateAppointment(req, id, { status: 'CheckedIn' });
}

export async function removeAppointment(req, id) {
  const existing = await prisma.appointment.findFirst({ where: { id: BigInt(id), tenantId: req.tenantId, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Appointment not found');
  await prisma.appointment.update({ where: { id: BigInt(id) }, data: { deletedAt: new Date() } });
  await recordAudit({ req, moduleName: 'appointments', actionType: 'DELETE', entityName: 'appointments', entityId: BigInt(id), oldValues: existing });
  return { id };
}

/** Doctor's queue for "today" or a given date, ordered by token number. */
export async function getDoctorQueue(req, doctorId, date) {
  const { start, end } = dayBounds(date || new Date());
  return prisma.appointment.findMany({
    where: { tenantId: req.tenantId, doctorId: BigInt(doctorId), appointmentTime: { gte: start, lte: end }, deletedAt: null },
    include: appointmentInclude,
    orderBy: { tokenNumber: 'asc' },
  });
}
