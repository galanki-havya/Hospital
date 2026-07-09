import prisma from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';

const PATIENT_SELECT = { id: true, firstName: true, lastName: true, uhid: true };

export async function listVoiceNotes(req, { page, limit, skip } = {}, filters = {}) {
  const where = { tenantId: req.tenantId };
  if (filters.patientId) where.patientId = BigInt(filters.patientId);
  if (filters.type) where.type = filters.type;
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search } },
      { text: { contains: filters.search } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.voiceNote.findMany({
      where,
      include: { patient: { select: PATIENT_SELECT } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.voiceNote.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function createVoiceNote(req, data) {
  if (data.patientId) {
    const patient = await prisma.patient.findFirst({ where: { id: BigInt(data.patientId), tenantId: req.tenantId } });
    if (!patient) throw ApiError.notFound('Patient not found');
  }

  return prisma.voiceNote.create({
    data: {
      tenantId: req.tenantId,
      title: data.title,
      type: data.type || 'General',
      text: data.text,
      patientId: data.patientId ? BigInt(data.patientId) : null,
      createdBy: req.user?.id ?? null,
    },
    include: { patient: { select: PATIENT_SELECT } },
  });
}

export async function updateVoiceNote(req, id, data) {
  const existing = await prisma.voiceNote.findFirst({ where: { id: BigInt(id), tenantId: req.tenantId } });
  if (!existing) throw ApiError.notFound('Note not found');

  return prisma.voiceNote.update({
    where: { id: BigInt(id) },
    data: {
      title: data.title ?? existing.title,
      type: data.type ?? existing.type,
      text: data.text ?? existing.text,
    },
    include: { patient: { select: PATIENT_SELECT } },
  });
}

export async function deleteVoiceNote(req, id) {
  const existing = await prisma.voiceNote.findFirst({ where: { id: BigInt(id), tenantId: req.tenantId } });
  if (!existing) throw ApiError.notFound('Note not found');

  await prisma.voiceNote.delete({ where: { id: BigInt(id) } });
  return { id };
}
