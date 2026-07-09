import prisma from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { createCrudService } from './crudServiceFactory.js';
import { recordAudit } from './auditService.js';

export const designationService = createCrudService('designation', {
  searchFields: ['designationName'],
  moduleName: 'hr',
  entityLabel: 'Designation',
  softDelete: false,
});

const employeeInclude = {
  department: { select: { id: true, name: true } },
  designation: { select: { id: true, designationName: true } },
};

export const employeeService = createCrudService('employee', {
  searchFields: ['firstName', 'lastName', 'employeeCode', 'email'],
  moduleName: 'hr',
  entityLabel: 'Employee',
  include: employeeInclude,
});

export const leaveTypeService = createCrudService('leaveType', {
  searchFields: ['leaveName'],
  moduleName: 'hr',
  entityLabel: 'Leave type',
  softDelete: false,
});

export async function markAttendance(req, data) {
  const employee = await prisma.employee.findFirst({ where: { id: BigInt(data.employeeId), tenantId: req.tenantId } });
  if (!employee) throw ApiError.notFound('Employee not found');

  const date = new Date(data.attendanceDate);
  date.setHours(0, 0, 0, 0);

  const existing = await prisma.attendance.findFirst({ where: { employeeId: BigInt(data.employeeId), attendanceDate: date } });

  const payload = {
    employeeId: BigInt(data.employeeId),
    attendanceDate: date,
    checkInTime: data.checkInTime ? new Date(data.checkInTime) : null,
    checkOutTime: data.checkOutTime ? new Date(data.checkOutTime) : null,
    status: data.status || 'Present',
  };

  // compute work hours if both timestamps present
  if (payload.checkInTime && payload.checkOutTime) {
    const hours = (payload.checkOutTime - payload.checkInTime) / 3_600_000;
    payload.workHours = Math.max(0, Number(hours.toFixed(2)));
  }

  if (existing) {
    return prisma.attendance.update({ where: { id: existing.id }, data: payload });
  }
  return prisma.attendance.create({ data: payload });
}

// ── Mobile Attendance App: geo-located self check-in/out ───────────────────────

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function resolveSelfEmployee(req) {
  const employee = await prisma.employee.findFirst({ where: { userId: req.user.id, tenantId: req.tenantId } });
  if (!employee) throw ApiError.badRequest('Your login is not linked to an employee record. Ask HR to link your account.');
  return employee;
}

async function checkGeofence(req, lat, lng) {
  if (lat == null || lng == null) return null;
  const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
  if (!tenant?.officeLat || !tenant?.officeLng || !tenant?.geofenceRadiusMeters) return null; // not configured — skip check
  const distance = haversineMeters(Number(tenant.officeLat), Number(tenant.officeLng), lat, lng);
  return distance <= tenant.geofenceRadiusMeters;
}

export async function selfCheckIn(req, { lat, lng, address }) {
  const employee = await resolveSelfEmployee(req);

  const date = new Date();
  date.setHours(0, 0, 0, 0);

  const existing = await prisma.attendance.findFirst({ where: { employeeId: employee.id, attendanceDate: date } });
  if (existing?.checkInTime) throw ApiError.badRequest('Already checked in today');

  const withinGeofence = await checkGeofence(req, lat, lng);

  const payload = {
    employeeId: employee.id,
    attendanceDate: date,
    checkInTime: new Date(),
    status: 'Present',
    source: 'Mobile',
    checkInLat: lat ?? null,
    checkInLng: lng ?? null,
    checkInAddress: address || null,
    withinGeofence,
  };

  const record = existing
    ? await prisma.attendance.update({ where: { id: existing.id }, data: payload })
    : await prisma.attendance.create({ data: payload });

  return { ...record, geofenceWarning: withinGeofence === false ? 'You appear to be outside the registered office location.' : null };
}

export async function selfCheckOut(req, { lat, lng }) {
  const employee = await resolveSelfEmployee(req);

  const date = new Date();
  date.setHours(0, 0, 0, 0);

  const existing = await prisma.attendance.findFirst({ where: { employeeId: employee.id, attendanceDate: date } });
  if (!existing?.checkInTime) throw ApiError.badRequest('You have not checked in today');
  if (existing.checkOutTime) throw ApiError.badRequest('Already checked out today');

  const checkOutTime = new Date();
  const hours = (checkOutTime - existing.checkInTime) / 3_600_000;

  return prisma.attendance.update({
    where: { id: existing.id },
    data: {
      checkOutTime,
      workHours: Math.max(0, Number(hours.toFixed(2))),
      checkOutLat: lat ?? null,
      checkOutLng: lng ?? null,
    },
  });
}

export async function getSelfAttendanceStatus(req) {
  const employee = await resolveSelfEmployee(req);
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  const today = await prisma.attendance.findFirst({ where: { employeeId: employee.id, attendanceDate: date } });
  return { employee: { id: employee.id, employeeCode: employee.employeeCode, firstName: employee.firstName, lastName: employee.lastName }, today: today || null };
}

export async function listAttendance(req, { page, limit, skip, sortBy, sortDir }, filters = {}) {
  const where = {};
  if (filters.employeeId) where.employeeId = BigInt(filters.employeeId);
  if (filters.month && filters.year) {
    const y = parseInt(filters.year), m = parseInt(filters.month) - 1;
    where.attendanceDate = { gte: new Date(y, m, 1), lt: new Date(y, m + 1, 1) };
  }

  const [items, total] = await Promise.all([
    prisma.attendance.findMany({ where, include: { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } } }, orderBy: { attendanceDate: 'desc' }, skip, take: limit }),
    prisma.attendance.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function applyLeave(req, data) {
  const [employee, leaveType] = await Promise.all([
    prisma.employee.findFirst({ where: { id: BigInt(data.employeeId), tenantId: req.tenantId } }),
    prisma.leaveType.findFirst({ where: { id: BigInt(data.leaveTypeId), tenantId: req.tenantId } }),
  ]);
  if (!employee) throw ApiError.notFound('Employee not found');
  if (!leaveType) throw ApiError.notFound('Leave type not found');

  const from = new Date(data.fromDate);
  const to = new Date(data.toDate);
  if (from > to) throw ApiError.badRequest('fromDate must be before or equal to toDate');

  const totalDays = Math.round((to - from) / 86_400_000) + 1;

  const leave = await prisma.leaveApplication.create({
    data: {
      employeeId: BigInt(data.employeeId),
      leaveTypeId: BigInt(data.leaveTypeId),
      fromDate: from,
      toDate: to,
      totalDays,
      reason: data.reason || null,
      status: 'Pending',
    },
    include: { employee: { select: { firstName: true, lastName: true } }, leaveType: { select: { leaveName: true } } },
  });

  await recordAudit({ req, moduleName: 'hr', actionType: 'CREATE', entityName: 'leave_applications', entityId: leave.id, newValues: data });
  return leave;
}

export async function updateLeaveStatus(req, leaveId, status) {
  const leave = await prisma.leaveApplication.findFirst({ where: { id: BigInt(leaveId) }, include: { employee: { select: { tenantId: true } } } });
  if (!leave || leave.employee.tenantId !== req.tenantId) throw ApiError.notFound('Leave application not found');

  return prisma.leaveApplication.update({
    where: { id: BigInt(leaveId) },
    data: { status, approvedBy: req.user.id },
    include: { employee: { select: { firstName: true, lastName: true } }, leaveType: { select: { leaveName: true } } },
  });
}

export async function listLeaves(req, { page, limit, skip }, filters = {}) {
  const where = {};
  if (filters.employeeId) where.employeeId = BigInt(filters.employeeId);
  if (filters.status) where.status = filters.status;

  const [items, total] = await Promise.all([
    prisma.leaveApplication.findMany({
      where,
      include: {
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } } } },
        leaveType: { select: { leaveName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.leaveApplication.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function generatePayroll(req, data) {
  const employee = await prisma.employee.findFirst({ where: { id: BigInt(data.employeeId), tenantId: req.tenantId } });
  if (!employee) throw ApiError.notFound('Employee not found');

  const existing = await prisma.payroll.findFirst({ where: { employeeId: BigInt(data.employeeId), payrollMonth: data.payrollMonth, payrollYear: data.payrollYear } });
  if (existing) throw ApiError.conflict('Payroll for this employee and period already exists');

  const basicSalary = Number(employee.basicSalary ?? 0);
  const allowances = data.allowances ?? 0;
  const overtimeAmount = data.overtimeAmount ?? 0;
  const deductions = data.deductions ?? 0;
  const taxAmount = data.taxAmount ?? 0;
  const netSalary = basicSalary + allowances + overtimeAmount - deductions - taxAmount;

  const payroll = await prisma.payroll.create({
    data: {
      employeeId: BigInt(data.employeeId),
      payrollMonth: data.payrollMonth,
      payrollYear: data.payrollYear,
      basicSalary,
      allowances,
      overtimeAmount,
      deductions,
      taxAmount,
      netSalary,
      paymentStatus: 'Pending',
    },
    include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } },
  });

  await recordAudit({ req, moduleName: 'hr', actionType: 'CREATE', entityName: 'payroll', entityId: payroll.id, newValues: data });
  return payroll;
}

export async function markPayrollPaid(req, payrollId) {
  const payroll = await prisma.payroll.findFirst({ where: { id: BigInt(payrollId) }, include: { employee: { select: { tenantId: true } } } });
  if (!payroll || payroll.employee.tenantId !== req.tenantId) throw ApiError.notFound('Payroll record not found');
  return prisma.payroll.update({ where: { id: BigInt(payrollId) }, data: { paymentStatus: 'Paid', paymentDate: new Date() } });
}

export async function listPayrolls(req, { page, limit, skip }, filters = {}) {
  const where = {};
  if (filters.employeeId) where.employeeId = BigInt(filters.employeeId);
  if (filters.payrollYear) where.payrollYear = parseInt(filters.payrollYear);
  if (filters.payrollMonth) where.payrollMonth = parseInt(filters.payrollMonth);

  const [items, total] = await Promise.all([
    prisma.payroll.findMany({ where, include: { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } } }, orderBy: [{ payrollYear: 'desc' }, { payrollMonth: 'desc' }], skip, take: limit }),
    prisma.payroll.count({ where }),
  ]);
  return { items, total, page, limit };
}
