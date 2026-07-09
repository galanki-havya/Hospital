import prisma from '../config/prisma.js';
import { emit } from './realtimeService.js';
import { ApiError } from '../utils/ApiError.js';
import { createCrudService } from './crudServiceFactory.js';

export const otRoomService = createCrudService('oTRoom', {
  searchFields: ['name', 'roomNumber'],
  moduleName: 'ot',
  entityLabel: 'OT Room',
  softDelete: false,
});

const otScheduleInclude = {
  patient: { select: { id: true, firstName: true, lastName: true, uhid: true } },
  doctor: { select: { id: true, firstName: true, lastName: true, specialization: true } },
  otRoom: { select: { id: true, name: true, roomNumber: true } },
};

export const otScheduleService = createCrudService('oTSchedule', {
  searchFields: ['surgeryName'],
  moduleName: 'ot',
  entityLabel: 'OT Schedule',
  include: otScheduleInclude,
  softDelete: false,
});

export async function listSchedules(req, { page, limit, skip, sortBy, sortDir }, filters = {}) {
  const where = { tenantId: req.tenantId };
  if (filters.status) where.status = filters.status;
  if (filters.doctorId) where.doctorId = BigInt(filters.doctorId);
  if (filters.date) {
    const d = new Date(filters.date);
    where.scheduledDate = { gte: d, lt: new Date(d.getTime() + 86400000) };
  }
  if (filters.fromDate && filters.toDate) {
    where.scheduledDate = { gte: new Date(filters.fromDate), lte: new Date(filters.toDate) };
  }

  const [items, total] = await Promise.all([
    prisma.oTSchedule.findMany({ where, include: otScheduleInclude, orderBy: { scheduledDate: 'desc' }, skip, take: limit }),
    prisma.oTSchedule.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function updateStatus(req, id, status, notes) {
  const schedule = await prisma.oTSchedule.findFirst({ where: { id: BigInt(id), tenantId: req.tenantId } });
  if (!schedule) throw ApiError.notFound('OT Schedule not found');

  const data = { status };
  if (notes) data.postOpNotes = notes;
  if (status === 'InProgress' && !schedule.startTime) data.startTime = new Date();
  if (status === 'Completed' && !schedule.endTime) {
    data.endTime = new Date();
    if (schedule.startTime) {
      data.durationMinutes = Math.round((data.endTime - schedule.startTime) / 60000);
    }
  }

  const updated = await prisma.oTSchedule.update({ where: { id: BigInt(id) }, data, include: otScheduleInclude });
  emit.otStatusChanged(req.tenantId, id, status, schedule.surgeryName);
  return updated;
}

export async function getOTStats(req) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const [todayScheduled, todayCompleted, totalRooms, activeRooms] = await Promise.all([
    prisma.oTSchedule.count({ where: { tenantId: req.tenantId, scheduledDate: { gte: today, lt: tomorrow } } }),
    prisma.oTSchedule.count({ where: { tenantId: req.tenantId, scheduledDate: { gte: today, lt: tomorrow }, status: 'Completed' } }),
    prisma.oTRoom.count({ where: { tenantId: req.tenantId } }),
    prisma.oTRoom.count({ where: { tenantId: req.tenantId, isActive: true } }),
  ]);

  return { todayScheduled, todayCompleted, totalRooms, activeRooms };
}
