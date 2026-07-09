import prisma from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { createCrudService } from './crudServiceFactory.js';

export const salaryStructureService = createCrudService('salaryStructure', {
  searchFields: ['name'],
  moduleName: 'hr',
  entityLabel: 'Salary Structure',
  softDelete: false,
});

export async function listStructures(req, { page, limit, skip }) {
  const where = { tenantId: req.tenantId };
  const [items, total] = await Promise.all([
    prisma.salaryStructure.findMany({ where, orderBy: { name: 'asc' }, skip, take: limit }),
    prisma.salaryStructure.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function assignStructureToEmployee(req, data) {
  const employee = await prisma.employee.findFirst({ where: { id: BigInt(data.employeeId), tenantId: req.tenantId } });
  if (!employee) throw ApiError.notFound('Employee not found');

  const structure = await prisma.salaryStructure.findFirst({ where: { id: BigInt(data.structureId), tenantId: req.tenantId } });
  if (!structure) throw ApiError.notFound('Salary structure not found');

  // deactivate previous
  await prisma.salaryAssignment.updateMany({
    where: { employeeId: BigInt(data.employeeId), tenantId: req.tenantId, effectiveTo: null },
    data: { effectiveTo: new Date(data.effectiveFrom) },
  });

  return prisma.salaryAssignment.create({
    data: {
      tenantId: req.tenantId,
      employeeId: BigInt(data.employeeId),
      structureId: BigInt(data.structureId),
      ctc: data.ctc,
      effectiveFrom: new Date(data.effectiveFrom),
    },
    include: { structure: true },
  });
}

/**
 * Break down CTC into components based on structure percentages.
 * Returns { basic, hra, da, medical, travel, other, gross,
 *           employeePF, employerPF, employeeESI, employerESI, tds, netSalary }
 */
export function calculateBreakdown(structure, ctc) {
  const gross = Number(ctc);
  const basic = (gross * Number(structure.basicPercent)) / 100;
  const hra = (gross * Number(structure.hraPercent)) / 100;
  const da = (gross * Number(structure.daPercent)) / 100;
  const medical = Number(structure.medicalFixed);
  const travel = Number(structure.travelFixed);
  const other = Number(structure.otherFixed);

  // PF: 12% of basic, capped at ₹15,000 wage ceiling (PF on max ₹15k)
  const pfWage = structure.pfCap ? Math.min(basic, Number(structure.pfCap)) : basic;
  const employeePF = (pfWage * Number(structure.pfPercent)) / 100;
  const employerPF = employeePF; // matched by employer

  // ESI: 0.75% employee, 3.25% employer — only if gross <= esiWageCap
  const esiApplicable = gross <= Number(structure.esiWageCap);
  const employeeESI = esiApplicable ? (gross * Number(structure.esiPercent)) / 100 : 0;
  const employerESI = esiApplicable ? (gross * 3.25) / 100 : 0;

  const tds = (gross * Number(structure.tdsPercent)) / 100;
  const totalDeductions = employeePF + employeeESI + tds;
  const netSalary = gross - totalDeductions;

  return {
    gross: +gross.toFixed(2),
    basic: +basic.toFixed(2),
    hra: +hra.toFixed(2),
    da: +da.toFixed(2),
    medical: +medical.toFixed(2),
    travel: +travel.toFixed(2),
    other: +other.toFixed(2),
    pfWage: +pfWage.toFixed(2),
    employeePF: +employeePF.toFixed(2),
    employerPF: +employerPF.toFixed(2),
    esiApplicable,
    employeeESI: +employeeESI.toFixed(2),
    employerESI: +employerESI.toFixed(2),
    tds: +tds.toFixed(2),
    totalDeductions: +totalDeductions.toFixed(2),
    netSalary: +netSalary.toFixed(2),
  };
}

export async function previewBreakdown(req, structureId, ctc) {
  const structure = await prisma.salaryStructure.findFirst({ where: { id: BigInt(structureId), tenantId: req.tenantId } });
  if (!structure) throw ApiError.notFound('Structure not found');
  return { structure, breakdown: calculateBreakdown(structure, ctc) };
}

// ── OVERTIME ─────────────────────────────────────────────────────────────────

export async function listOvertimeRecords(req, { page, limit, skip }, filters = {}) {
  const where = { tenantId: req.tenantId };
  if (filters.employeeId) where.employeeId = BigInt(filters.employeeId);
  if (filters.isApproved !== undefined) where.isApproved = filters.isApproved === 'true';
  if (filters.month) {
    const [y, m] = filters.month.split('-');
    where.date = { gte: new Date(+y, +m - 1, 1), lt: new Date(+y, +m, 1) };
  }

  const [items, total] = await Promise.all([
    prisma.overtimeRecord.findMany({
      where,
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } } },
      orderBy: { date: 'desc' },
      skip,
      take: limit,
    }),
    prisma.overtimeRecord.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function createOvertimeRecord(req, data) {
  const employee = await prisma.employee.findFirst({ where: { id: BigInt(data.employeeId), tenantId: req.tenantId } });
  if (!employee) throw ApiError.notFound('Employee not found');

  const workedHours = parseFloat(data.workedHours);
  const regularHours = parseFloat(data.regularHours) || 8;
  const overtimeHrs = Math.max(0, workedHours - regularHours);
  const overtimeRate = parseFloat(data.overtimeRate) || (Number(employee.basicSalary || 0) / 26 / 8 * 2);
  const overtimePay = overtimeHrs * overtimeRate;

  return prisma.overtimeRecord.create({
    data: {
      tenantId: req.tenantId,
      employeeId: BigInt(data.employeeId),
      date: new Date(data.date),
      regularHours,
      workedHours,
      overtimeHrs,
      overtimeRate,
      overtimePay,
      notes: data.notes || null,
    },
    include: { employee: { select: { id: true, firstName: true, lastName: true } } },
  });
}

export async function approveOvertime(req, id) {
  const record = await prisma.overtimeRecord.findFirst({ where: { id: BigInt(id), tenantId: req.tenantId } });
  if (!record) throw ApiError.notFound('Overtime record not found');
  return prisma.overtimeRecord.update({
    where: { id: BigInt(id) },
    data: { isApproved: true, approvedBy: req.user?.id ? BigInt(req.user.id) : null },
  });
}

// ── STATUTORY REGISTER (PF / ESI / TDS) ─────────────────────────────────────

export async function generateStatutoryRegister(req, month, year) {
  const payrolls = await prisma.payroll.findMany({
    where: { tenantId: req.tenantId, payrollMonth: parseInt(month), payrollYear: parseInt(year) },
    include: {
      employee: {
        include: {
          salaryAssignments: {
            where: { effectiveTo: null },
            include: { structure: true },
            take: 1,
          },
        },
      },
    },
  });

  const records = [];
  for (const p of payrolls) {
    const emp = p.employee;
    const assignment = emp.salaryAssignments?.[0];
    const structure = assignment?.structure;

    let breakdown = { employeePF: 0, employerPF: 0, employeeESI: 0, employerESI: 0, tds: 0 };
    if (structure && assignment) {
      breakdown = calculateBreakdown(structure, assignment.ctc);
    } else {
      // fallback: use payroll deductions
      breakdown.employeePF = Number(p.deductions) * 0.5;
      breakdown.employerPF = breakdown.employeePF;
      breakdown.tds = Number(p.taxAmount);
    }

    const gross = Number(p.basicSalary) + Number(p.allowances);
    const existing = await prisma.statutoryRegister.findFirst({
      where: { tenantId: req.tenantId, employeeId: emp.id, month: parseInt(month), year: parseInt(year) },
    });

    const payload = {
      tenantId: req.tenantId,
      employeeId: emp.id,
      month: parseInt(month),
      year: parseInt(year),
      grossWages: gross,
      pfWages: breakdown.pfWage ?? gross,
      employeePF: breakdown.employeePF,
      employerPF: breakdown.employerPF,
      esiWages: gross,
      employeeESI: breakdown.employeeESI,
      employerESI: breakdown.employerESI,
      tds: breakdown.tds,
      panNumber: emp.panNumber || null,
      pfNumber: emp.pfNumber || null,
      esiNumber: emp.esiNumber || null,
    };

    if (existing) {
      records.push(await prisma.statutoryRegister.update({ where: { id: existing.id }, data: payload }));
    } else {
      records.push(await prisma.statutoryRegister.create({ data: payload }));
    }
  }

  return { generated: records.length, month: parseInt(month), year: parseInt(year) };
}

export async function listStatutoryRegister(req, { page, limit, skip }, filters = {}) {
  const where = { tenantId: req.tenantId };
  if (filters.month) where.month = parseInt(filters.month);
  if (filters.year) where.year = parseInt(filters.year);
  if (filters.employeeId) where.employeeId = BigInt(filters.employeeId);

  const [items, total] = await Promise.all([
    prisma.statutoryRegister.findMany({
      where,
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { employee: { firstName: 'asc' } }],
      skip,
      take: limit,
    }),
    prisma.statutoryRegister.count({ where }),
  ]);

  // Aggregate totals
  const agg = await prisma.statutoryRegister.aggregate({
    where,
    _sum: { grossWages: true, employeePF: true, employerPF: true, employeeESI: true, employerESI: true, tds: true },
  });

  return { items, total, page, limit, totals: agg._sum };
}
