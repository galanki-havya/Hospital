import prisma from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { createCrudService } from './crudServiceFactory.js';

// ── DIET / KITCHEN ────────────────────────────────────────────────────────────

export const dietPlanService = createCrudService('dietPlan', {
  searchFields: ['name'],
  moduleName: 'diet',
  entityLabel: 'Diet Plan',
  softDelete: false,
});

export async function listDietAssignments(req, { page, limit, skip }, filters = {}) {
  const where = { tenantId: req.tenantId };
  if (filters.patientId) where.patientId = BigInt(filters.patientId);
  if (filters.admissionId) where.admissionId = BigInt(filters.admissionId);
  if (filters.mealType) where.mealType = filters.mealType;

  const [items, total] = await Promise.all([
    prisma.dietAssignment.findMany({
      where,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, uhid: true } },
        dietPlan: { select: { id: true, name: true, dietType: true, calories: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.dietAssignment.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function assignDiet(req, data) {
  const patient = await prisma.patient.findFirst({ where: { id: BigInt(data.patientId), tenantId: req.tenantId } });
  if (!patient) throw ApiError.notFound('Patient not found');
  const plan = await prisma.dietPlan.findFirst({ where: { id: BigInt(data.dietPlanId), tenantId: req.tenantId } });
  if (!plan) throw ApiError.notFound('Diet plan not found');

  return prisma.dietAssignment.create({
    data: {
      tenantId: req.tenantId,
      patientId: BigInt(data.patientId),
      admissionId: data.admissionId ? BigInt(data.admissionId) : null,
      dietPlanId: BigInt(data.dietPlanId),
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      mealType: data.mealType,
      notes: data.notes || null,
      assignedBy: req.user?.id ? BigInt(req.user.id) : null,
    },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
      dietPlan: { select: { id: true, name: true } },
    },
  });
}

// ── AMBULANCE ─────────────────────────────────────────────────────────────────

export const ambulanceService = createCrudService('ambulance', {
  searchFields: ['vehicleNumber', 'driverName'],
  moduleName: 'ambulance',
  entityLabel: 'Ambulance',
  softDelete: false,
});

export async function listAmbulanceCalls(req, { page, limit, skip }, filters = {}) {
  const where = { tenantId: req.tenantId };
  if (filters.ambulanceId) where.ambulanceId = BigInt(filters.ambulanceId);

  const [items, total] = await Promise.all([
    prisma.ambulanceCall.findMany({
      where,
      include: {
        ambulance: { select: { id: true, vehicleNumber: true, vehicleType: true } },
        patient: { select: { id: true, firstName: true, lastName: true, uhid: true } },
      },
      orderBy: { callTime: 'desc' },
      skip,
      take: limit,
    }),
    prisma.ambulanceCall.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function createAmbulanceCall(req, data) {
  const ambulance = await prisma.ambulance.findFirst({ where: { id: BigInt(data.ambulanceId), tenantId: req.tenantId } });
  if (!ambulance) throw ApiError.notFound('Ambulance not found');
  if (ambulance.status === 'OnCall') throw ApiError.badRequest('Ambulance is already on call');

  const call = await prisma.ambulanceCall.create({
    data: {
      tenantId: req.tenantId,
      ambulanceId: BigInt(data.ambulanceId),
      patientId: data.patientId ? BigInt(data.patientId) : null,
      callerName: data.callerName,
      callerPhone: data.callerPhone,
      pickupAddress: data.pickupAddress,
      destination: data.destination || null,
      charges: data.charges || 0,
      notes: data.notes || null,
    },
    include: { ambulance: { select: { id: true, vehicleNumber: true } } },
  });

  await prisma.ambulance.update({ where: { id: BigInt(data.ambulanceId) }, data: { status: 'OnCall' } });
  return call;
}

export async function updateAmbulanceCall(req, callId, data) {
  const call = await prisma.ambulanceCall.findFirst({ where: { id: BigInt(callId), tenantId: req.tenantId } });
  if (!call) throw ApiError.notFound('Call not found');

  const updateData = {};
  if (data.dispatchTime) updateData.dispatchTime = new Date(data.dispatchTime);
  if (data.arrivalTime) updateData.arrivalTime = new Date(data.arrivalTime);
  if (data.returnTime) {
    updateData.returnTime = new Date(data.returnTime);
    await prisma.ambulance.update({ where: { id: call.ambulanceId }, data: { status: 'Available' } });
  }
  if (data.distance) updateData.distance = data.distance;
  if (data.charges) updateData.charges = data.charges;

  return prisma.ambulanceCall.update({ where: { id: BigInt(callId) }, data: updateData });
}

// ── VISITOR MANAGEMENT ────────────────────────────────────────────────────────

export async function listVisitors(req, { page, limit, skip }, filters = {}) {
  const where = { tenantId: req.tenantId };
  if (filters.patientId) where.patientId = BigInt(filters.patientId);
  if (filters.today === 'true') {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    where.checkInAt = { gte: today };
  }
  if (filters.active === 'true') where.checkOutAt = null;

  const [items, total] = await Promise.all([
    prisma.visitor.findMany({
      where,
      include: { patient: { select: { id: true, firstName: true, lastName: true, uhid: true } } },
      orderBy: { checkInAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.visitor.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function checkInVisitor(req, data) {
  const count = await prisma.visitor.count({ where: { tenantId: req.tenantId } });
  const badgeNumber = `VIS-${String(count + 1).padStart(5, '0')}`;

  return prisma.visitor.create({
    data: {
      tenantId: req.tenantId,
      patientId: data.patientId ? BigInt(data.patientId) : null,
      name: data.name,
      phone: data.phone || null,
      relation: data.relation || null,
      idType: data.idType || null,
      idNumber: data.idNumber || null,
      purpose: data.purpose || null,
      badgeNumber,
      notes: data.notes || null,
    },
    include: { patient: { select: { id: true, firstName: true, lastName: true } } },
  });
}

export async function checkOutVisitor(req, id) {
  const visitor = await prisma.visitor.findFirst({ where: { id: BigInt(id), tenantId: req.tenantId } });
  if (!visitor) throw ApiError.notFound('Visitor not found');
  if (visitor.checkOutAt) throw ApiError.badRequest('Visitor already checked out');
  return prisma.visitor.update({ where: { id: BigInt(id) }, data: { checkOutAt: new Date() } });
}

// ── COMPLAINTS / FEEDBACK ─────────────────────────────────────────────────────

export async function listComplaints(req, { page, limit, skip }, filters = {}) {
  const where = { tenantId: req.tenantId };
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.category) where.category = { contains: filters.category };

  const [items, total] = await Promise.all([
    prisma.complaint.findMany({
      where,
      include: { patient: { select: { id: true, firstName: true, lastName: true, uhid: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.complaint.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function createComplaint(req, data) {
  return prisma.complaint.create({
    data: {
      tenantId: req.tenantId,
      patientId: data.patientId ? BigInt(data.patientId) : null,
      complainantName: data.complainantName,
      phone: data.phone || null,
      email: data.email || null,
      category: data.category,
      subject: data.subject,
      description: data.description,
      priority: data.priority || 'Medium',
    },
  });
}

export async function updateComplaint(req, id, data) {
  const complaint = await prisma.complaint.findFirst({ where: { id: BigInt(id), tenantId: req.tenantId } });
  if (!complaint) throw ApiError.notFound('Complaint not found');

  const updateData = {};
  if (data.status) {
    updateData.status = data.status;
    if (data.status === 'Resolved') updateData.resolvedAt = new Date();
  }
  if (data.resolution) updateData.resolution = data.resolution;
  if (data.assignedTo) updateData.assignedTo = BigInt(data.assignedTo);
  if (data.rating !== undefined) updateData.rating = data.rating;
  if (data.priority) updateData.priority = data.priority;

  return prisma.complaint.update({ where: { id: BigInt(id) }, data: updateData });
}

export async function getComplaintStats(req) {
  const [total, open, resolved, escalated] = await Promise.all([
    prisma.complaint.count({ where: { tenantId: req.tenantId } }),
    prisma.complaint.count({ where: { tenantId: req.tenantId, status: 'Open' } }),
    prisma.complaint.count({ where: { tenantId: req.tenantId, status: 'Resolved' } }),
    prisma.complaint.count({ where: { tenantId: req.tenantId, status: 'Escalated' } }),
  ]);
  return { total, open, resolved, escalated };
}

// ── MORTUARY ──────────────────────────────────────────────────────────────────

export async function listMortuaryRecords(req, { page, limit, skip }, filters = {}) {
  const where = { tenantId: req.tenantId };
  if (filters.status) where.status = filters.status;

  const [items, total] = await Promise.all([
    prisma.mortuaryRecord.findMany({
      where,
      include: { patient: { select: { id: true, firstName: true, lastName: true, uhid: true } } },
      orderBy: { dateOfDeath: 'desc' },
      skip,
      take: limit,
    }),
    prisma.mortuaryRecord.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function createMortuaryRecord(req, data) {
  const count = await prisma.mortuaryRecord.count({ where: { tenantId: req.tenantId } });
  const lockerNumber = data.lockerNumber || `L-${String(count + 1).padStart(3, '0')}`;

  return prisma.mortuaryRecord.create({
    data: {
      tenantId: req.tenantId,
      patientId: data.patientId ? BigInt(data.patientId) : null,
      deceasedName: data.deceasedName,
      gender: data.gender || null,
      age: data.age ? parseInt(data.age) : null,
      dateOfDeath: new Date(data.dateOfDeath),
      causeOfDeath: data.causeOfDeath || null,
      admissionId: data.admissionId ? BigInt(data.admissionId) : null,
      lockerNumber,
      policeCase: data.policeCase || false,
      policeCaseNo: data.policeCaseNo || null,
      postmortem: data.postmortem || false,
      notes: data.notes || null,
    },
    include: { patient: { select: { id: true, firstName: true, lastName: true } } },
  });
}

export async function releaseMortuaryRecord(req, id, data) {
  const record = await prisma.mortuaryRecord.findFirst({ where: { id: BigInt(id), tenantId: req.tenantId } });
  if (!record) throw ApiError.notFound('Mortuary record not found');
  if (record.status === 'Released') throw ApiError.badRequest('Already released');

  return prisma.mortuaryRecord.update({
    where: { id: BigInt(id) },
    data: {
      status: 'Released',
      releasedTo: data.releasedTo,
      releasedAt: new Date(),
      notes: data.notes || record.notes,
    },
  });
}

// ── DOCUMENT VAULT ────────────────────────────────────────────────────────────

export async function listDocuments(req, { page, limit, skip }, filters = {}) {
  const where = { tenantId: req.tenantId };
  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.entityId) where.entityId = BigInt(filters.entityId);
  if (filters.docType) where.docType = { contains: filters.docType };

  const [items, total] = await Promise.all([
    prisma.documentVault.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.documentVault.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function createDocument(req, data) {
  return prisma.documentVault.create({
    data: {
      tenantId: req.tenantId,
      entityType: data.entityType,
      entityId: BigInt(data.entityId),
      docType: data.docType,
      title: data.title,
      fileUrl: data.fileUrl,
      fileMime: data.fileMime || null,
      fileSizeKb: data.fileSizeKb ? parseInt(data.fileSizeKb) : null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      uploadedBy: req.user?.id ? BigInt(req.user.id) : null,
    },
  });
}

export async function verifyDocument(req, id) {
  const doc = await prisma.documentVault.findFirst({ where: { id: BigInt(id), tenantId: req.tenantId } });
  if (!doc) throw ApiError.notFound('Document not found');
  return prisma.documentVault.update({ where: { id: BigInt(id) }, data: { isVerified: true } });
}

// ── LETTERS / NOC ─────────────────────────────────────────────────────────────

export const letterTemplateService = createCrudService('letterTemplate', {
  searchFields: ['name', 'letterType'],
  moduleName: 'letters',
  entityLabel: 'Letter Template',
  softDelete: false,
});

export async function issueLetterFromTemplate(req, templateId, data) {
  const template = await prisma.letterTemplate.findFirst({ where: { id: BigInt(templateId), tenantId: req.tenantId } });
  if (!template) throw ApiError.notFound('Template not found');

  // simple variable interpolation
  let content = template.body;
  if (data.variables) {
    for (const [key, val] of Object.entries(data.variables)) {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), val);
    }
  }

  return prisma.letterIssuance.create({
    data: {
      tenantId: req.tenantId,
      templateId: BigInt(templateId),
      entityType: data.entityType,
      entityId: BigInt(data.entityId),
      issuedTo: data.issuedTo,
      issuedBy: req.user?.id ? BigInt(req.user.id) : null,
      content,
    },
    include: { template: { select: { id: true, name: true, letterType: true } } },
  });
}

export async function listIssuances(req, { page, limit, skip }, filters = {}) {
  const where = { tenantId: req.tenantId };
  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.entityId) where.entityId = BigInt(filters.entityId);

  const [items, total] = await Promise.all([
    prisma.letterIssuance.findMany({
      where,
      include: { template: { select: { id: true, name: true, letterType: true } } },
      orderBy: { issuedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.letterIssuance.count({ where }),
  ]);
  return { items, total, page, limit };
}

// ── QR CHECK-IN ───────────────────────────────────────────────────────────────

import crypto from 'crypto';

export async function generateQR(req, data) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
  const qrData = JSON.stringify({
    token,
    appointmentId: data.appointmentId || null,
    patientId: data.patientId || null,
    tenantId: req.tenantId.toString(),
  });

  return prisma.qRCheckIn.create({
    data: {
      tenantId: req.tenantId,
      appointmentId: data.appointmentId ? BigInt(data.appointmentId) : null,
      patientId: data.patientId ? BigInt(data.patientId) : null,
      token,
      qrData,
      expiresAt,
    },
  });
}

export async function verifyQRToken(req, token) {
  const qr = await prisma.qRCheckIn.findFirst({ where: { token, tenantId: req.tenantId } });
  if (!qr) throw ApiError.notFound('Invalid QR token');
  if (qr.isUsed) throw ApiError.badRequest('QR token already used');
  if (new Date() > qr.expiresAt) throw ApiError.badRequest('QR token expired');

  await prisma.qRCheckIn.update({ where: { id: qr.id }, data: { isUsed: true, checkedInAt: new Date() } });
  return { success: true, checkedInAt: new Date(), qr };
}
