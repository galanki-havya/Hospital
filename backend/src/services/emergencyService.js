import prisma from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { recordAudit } from './auditService.js';

const caseInclude = {
  patient: {
    select: {
      id: true, uhid: true,
      firstName: true, lastName: true,
      gender: true, dob: true, bloodGroup: true,
      phone: true,
    },
  },
  assignedDoctor: {
    include: { user: { select: { firstName: true, lastName: true } } },
  },
  triageRecords: { orderBy: { createdAt: 'desc' } },
};

// ── List ──────────────────────────────────────────────────────────────────────

export async function listCases(req, { page, limit, skip, sortBy, sortDir }, filters = {}) {
  const where = { tenantId: req.tenantId };

  if (filters.status)   where.status   = filters.status;
  if (filters.severity) where.severity = filters.severity;

  if (filters.search) {
    where.patient = {
      OR: [
        { firstName: { contains: filters.search } },
        { lastName:  { contains: filters.search } },
        { uhid:      { contains: filters.search } },
        { phone:     { contains: filters.search } },
      ],
    };
  }

  const orderBy = sortBy === 'severity'
    // Critical first for clinical triage queue
    ? [{ severity: 'desc' }, { arrivalTime: 'asc' }]
    : { [sortBy === 'createdAt' ? 'arrivalTime' : sortBy]: sortDir };

  const [items, total] = await Promise.all([
    prisma.emergencyCase.findMany({
      where, include: caseInclude, orderBy, skip, take: limit,
    }),
    prisma.emergencyCase.count({ where }),
  ]);

  return { items, total, page, limit };
}

// ── Get one ───────────────────────────────────────────────────────────────────

export async function getCaseById(req, id) {
  const ec = await prisma.emergencyCase.findFirst({
    where: { id: BigInt(id), tenantId: req.tenantId },
    include: caseInclude,
  });
  if (!ec) throw ApiError.notFound('Emergency case not found');
  return ec;
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createCase(req, data) {
  const patient = await prisma.patient.findFirst({
    where: { id: BigInt(data.patientId), tenantId: req.tenantId, deletedAt: null },
  });
  if (!patient) throw ApiError.badRequest('Patient not found');

  if (data.assignedDoctorId) {
    const doctor = await prisma.doctor.findFirst({
      where: { id: BigInt(data.assignedDoctorId), tenantId: req.tenantId, deletedAt: null },
    });
    if (!doctor) throw ApiError.badRequest('Doctor not found');
  }

  const ec = await prisma.emergencyCase.create({
    data: {
      tenantId:        req.tenantId,
      patientId:       BigInt(data.patientId),
      arrivalTime:     data.arrivalTime ? new Date(data.arrivalTime) : new Date(),
      severity:        data.severity,
      chiefComplaint:  data.chiefComplaint || null,
      assignedDoctorId: data.assignedDoctorId ? BigInt(data.assignedDoctorId) : null,
      status:          'Waiting',
    },
    include: caseInclude,
  });

  // Fire-and-forget notification to assigned doctor
  if (data.assignedDoctorId) {
    const doctor = ec.assignedDoctor;
    prisma.notification.create({
      data: {
        tenantId: req.tenantId,
        userId:   doctor.userId,
        title:    `Emergency: ${data.severity} case assigned`,
        message:  `${patient.firstName} ${patient.lastName} — ${data.chiefComplaint || 'No complaint recorded'}`,
        notificationType: 'Emergency',
      },
    }).catch(() => {});
  }

  await recordAudit({
    req,
    moduleName: 'emergency',
    actionType: 'CREATE',
    entityName: 'emergency_cases',
    entityId:   ec.id,
    newValues:  data,
  });

  return ec;
}

// ── Update status / assignment ────────────────────────────────────────────────

export async function updateCase(req, id, data) {
  const existing = await prisma.emergencyCase.findFirst({
    where: { id: BigInt(id), tenantId: req.tenantId },
  });
  if (!existing) throw ApiError.notFound('Emergency case not found');

  // Guard against moving backwards through the workflow
  const ORDER = ['Waiting', 'InTreatment', 'Admitted', 'Discharged'];
  if (data.status) {
    const currentIdx = ORDER.indexOf(existing.status);
    const newIdx     = ORDER.indexOf(data.status);
    // Allow any forward move OR re-assign doctor without status change
    if (newIdx < currentIdx) {
      throw ApiError.badRequest(
        `Cannot revert status from "${existing.status}" to "${data.status}"`
      );
    }
  }

  const ec = await prisma.emergencyCase.update({
    where: { id: BigInt(id) },
    data: {
      severity:        data.severity        || undefined,
      chiefComplaint:  data.chiefComplaint  !== undefined ? data.chiefComplaint : undefined,
      assignedDoctorId: data.assignedDoctorId != null
        ? BigInt(data.assignedDoctorId)
        : data.assignedDoctorId === null ? null : undefined,
      status: data.status || undefined,
    },
    include: caseInclude,
  });

  await recordAudit({
    req,
    moduleName: 'emergency',
    actionType: 'UPDATE',
    entityName: 'emergency_cases',
    entityId:   ec.id,
    oldValues:  existing,
    newValues:  data,
  });

  return ec;
}

// ── Triage ────────────────────────────────────────────────────────────────────

export async function addTriageRecord(req, caseId, data) {
  const ec = await prisma.emergencyCase.findFirst({
    where: { id: BigInt(caseId), tenantId: req.tenantId },
  });
  if (!ec) throw ApiError.notFound('Emergency case not found');

  const triage = await prisma.triageRecord.create({
    data: {
      emergencyCaseId: BigInt(caseId),
      bloodPressure:    data.bloodPressure    || null,
      pulseRate:        data.pulseRate        ?? null,
      temperature:      data.temperature      ?? null,
      respiratoryRate:  data.respiratoryRate  ?? null,
      oxygenSaturation: data.oxygenSaturation ?? null,
      notes:            data.notes            || null,
    },
  });

  // Auto-escalate severity if SpO₂ < 90 or HR > 150 and case is still Waiting
  const critical = (data.oxygenSaturation && data.oxygenSaturation < 90) ||
                   (data.pulseRate && data.pulseRate > 150);
  if (critical && ec.status === 'Waiting' && ec.severity !== 'Critical') {
    await prisma.emergencyCase.update({
      where: { id: BigInt(caseId) },
      data:  { severity: 'Critical' },
    });
  }

  return triage;
}

// ── Dashboard stats ───────────────────────────────────────────────────────────

export async function getEmergencyStats(req) {
  const tenantId = req.tenantId;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [bySeverity, byStatus, todayTotal, avgWaitMinutes] = await Promise.all([
    prisma.emergencyCase.groupBy({
      by: ['severity'],
      where: { tenantId },
      _count: { id: true },
    }),
    prisma.emergencyCase.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { id: true },
    }),
    prisma.emergencyCase.count({
      where: { tenantId, arrivalTime: { gte: todayStart } },
    }),
    // Average minutes spent Waiting (arrivalTime → InTreatment) — approximated
    // from cases that moved to InTreatment today
    prisma.emergencyCase.findMany({
      where: {
        tenantId,
        status: { in: ['InTreatment', 'Admitted', 'Discharged'] },
        updatedAt: { gte: todayStart },
      },
      select: { arrivalTime: true, updatedAt: true },
    }),
  ]);

  const avgWait = avgWaitMinutes.length === 0
    ? null
    : Math.round(
        avgWaitMinutes.reduce(
          (sum, c) => sum + (c.updatedAt - c.arrivalTime) / 60_000,
          0
        ) / avgWaitMinutes.length
      );

  return {
    todayTotal,
    avgWaitMinutes: avgWait,
    bySeverity: bySeverity.map(r => ({ severity: r.severity, count: r._count.id })),
    byStatus:   byStatus.map(r => ({ status: r.status, count: r._count.id })),
    activeCount: byStatus
      .filter(r => ['Waiting', 'InTreatment'].includes(r.status))
      .reduce((s, r) => s + r._count.id, 0),
  };
}
