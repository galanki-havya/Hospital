import bcrypt from 'bcryptjs';
import prisma from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';
import { SYSTEM_ROLES } from '../config/roles.js';
import { recordAudit } from './auditService.js';
import { parseListQuery } from '../utils/query.js';

const doctorInclude = {
  user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, profilePhoto: true, isActive: true } },
  department: { select: { id: true, name: true } },
};

export async function listDoctors(req, listQuery, extraWhere = {}) {
  const { page, limit, skip, sortBy, sortDir, search } = listQuery;
  const where = { tenantId: req.tenantId, deletedAt: null, ...extraWhere };

  if (search) {
    where.OR = [
      { specialization: { contains: search } },
      { user: { firstName: { contains: search } } },
      { user: { lastName: { contains: search } } },
    ];
  }

  const orderBy = sortBy === 'createdAt' ? { createdAt: sortDir } : { [sortBy]: sortDir };

  const [items, total] = await Promise.all([
    prisma.doctor.findMany({ where, include: doctorInclude, orderBy, skip, take: limit }),
    prisma.doctor.count({ where }),
  ]);

  return { items, total, page, limit };
}

export async function getDoctorById(req, id) {
  const doctor = await prisma.doctor.findFirst({
    where: { id: BigInt(id), tenantId: req.tenantId, deletedAt: null },
    include: { ...doctorInclude, schedules: true },
  });
  if (!doctor) throw ApiError.notFound('Doctor not found');
  return doctor;
}

/** Creates a User (with Doctor role) + the linked Doctor profile in one transaction. */
export async function createDoctor(req, payload) {
  const existing = await prisma.user.findUnique({ where: { email: payload.email } });
  if (existing) throw ApiError.conflict('A user with this email already exists');

  const role = await prisma.role.findFirst({ where: { tenantId: req.tenantId, name: SYSTEM_ROLES.DOCTOR } });
  if (!role) throw ApiError.internal('Doctor role is not configured for this tenant');

  const passwordHash = await bcrypt.hash(payload.password, env.BCRYPT_SALT_ROUNDS);

  const doctor = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: payload.email,
        passwordHash,
        firstName: payload.firstName,
        lastName: payload.lastName || null,
        phone: payload.phone || null,
        isActive: true,
        emailVerified: true,
      },
    });

    await tx.tenantUser.create({ data: { tenantId: req.tenantId, userId: user.id, roleId: role.id } });

    return tx.doctor.create({
      data: {
        tenantId: req.tenantId,
        userId: user.id,
        departmentId: payload.departmentId || null,
        employeeCode: payload.employeeCode || null,
        specialization: payload.specialization || null,
        qualification: payload.qualification || null,
        consultationFee: payload.consultationFee ?? null,
        licenseNumber: payload.licenseNumber || null,
        experienceYears: payload.experienceYears ?? null,
      },
      include: doctorInclude,
    });
  });

  await recordAudit({ req, moduleName: 'doctors', actionType: 'CREATE', entityName: 'doctors', entityId: doctor.id, newValues: payload });
  return doctor;
}

export async function updateDoctor(req, id, data) {
  const existing = await prisma.doctor.findFirst({ where: { id: BigInt(id), tenantId: req.tenantId, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Doctor not found');

  const doctor = await prisma.doctor.update({ where: { id: BigInt(id) }, data, include: doctorInclude });
  await recordAudit({ req, moduleName: 'doctors', actionType: 'UPDATE', entityName: 'doctors', entityId: doctor.id, oldValues: existing, newValues: data });
  return doctor;
}

export async function removeDoctor(req, id) {
  const existing = await prisma.doctor.findFirst({ where: { id: BigInt(id), tenantId: req.tenantId, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Doctor not found');

  await prisma.doctor.update({ where: { id: BigInt(id) }, data: { deletedAt: new Date(), status: 'Inactive' } });
  await recordAudit({ req, moduleName: 'doctors', actionType: 'DELETE', entityName: 'doctors', entityId: BigInt(id), oldValues: existing });
  return { id };
}

export async function addSchedule(req, doctorId, payload) {
  const doctor = await prisma.doctor.findFirst({ where: { id: BigInt(doctorId), tenantId: req.tenantId, deletedAt: null } });
  if (!doctor) throw ApiError.notFound('Doctor not found');

  const toTimeDate = (t) => new Date(`1970-01-01T${t.length === 5 ? t + ':00' : t}.000Z`);

  return prisma.doctorSchedule.create({
    data: {
      tenantId: req.tenantId,
      doctorId: BigInt(doctorId),
      dayOfWeek: payload.dayOfWeek,
      startTime: toTimeDate(payload.startTime),
      endTime: toTimeDate(payload.endTime),
      maxPatients: payload.maxPatients ?? null,
    },
  });
}

export async function listSchedules(req, doctorId) {
  return prisma.doctorSchedule.findMany({ where: { tenantId: req.tenantId, doctorId: BigInt(doctorId) }, orderBy: { dayOfWeek: 'asc' } });
}

export async function removeSchedule(req, doctorId, scheduleId) {
  const schedule = await prisma.doctorSchedule.findFirst({ where: { id: BigInt(scheduleId), doctorId: BigInt(doctorId), tenantId: req.tenantId } });
  if (!schedule) throw ApiError.notFound('Schedule slot not found');
  await prisma.doctorSchedule.delete({ where: { id: BigInt(scheduleId) } });
  return { id: scheduleId };
}
