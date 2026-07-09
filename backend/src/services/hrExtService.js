import prisma from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { createCrudService } from './crudServiceFactory.js';

// ── SHIFTS / ROSTER ──────────────────────────────────────────────────────────

export const shiftTemplateService = createCrudService('shiftTemplate', {
  searchFields: ['name'],
  moduleName: 'shifts',
  entityLabel: 'Shift Template',
  softDelete: false,
});

export async function listShiftAssignments(req, { page, limit, skip }, filters = {}) {
  const where = { tenantId: req.tenantId };
  if (filters.employeeId) where.employeeId = BigInt(filters.employeeId);
  if (filters.fromDate && filters.toDate) {
    where.assignedDate = { gte: new Date(filters.fromDate), lte: new Date(filters.toDate) };
  }

  const [items, total] = await Promise.all([
    prisma.shiftAssignment.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        shift: { select: { id: true, name: true, startTime: true, endTime: true } },
      },
      orderBy: { assignedDate: 'desc' },
      skip,
      take: limit,
    }),
    prisma.shiftAssignment.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function assignShift(req, data) {
  const employee = await prisma.employee.findFirst({ where: { id: BigInt(data.employeeId), tenantId: req.tenantId } });
  if (!employee) throw ApiError.notFound('Employee not found');
  const shift = await prisma.shiftTemplate.findFirst({ where: { id: BigInt(data.shiftId), tenantId: req.tenantId } });
  if (!shift) throw ApiError.notFound('Shift not found');

  const date = new Date(data.assignedDate);
  const existing = await prisma.shiftAssignment.findFirst({
    where: { tenantId: req.tenantId, employeeId: BigInt(data.employeeId), assignedDate: date },
  });
  if (existing) {
    return prisma.shiftAssignment.update({
      where: { id: existing.id },
      data: { shiftId: BigInt(data.shiftId), notes: data.notes || null },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        shift: { select: { id: true, name: true, startTime: true, endTime: true } },
      },
    });
  }

  return prisma.shiftAssignment.create({
    data: {
      tenantId: req.tenantId,
      employeeId: BigInt(data.employeeId),
      shiftId: BigInt(data.shiftId),
      assignedDate: date,
      notes: data.notes || null,
    },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true } },
      shift: { select: { id: true, name: true, startTime: true, endTime: true } },
    },
  });
}

// ── DOCTOR REVENUE ────────────────────────────────────────────────────────────

export async function listDoctorRevenueRules(req, { page, limit, skip }, filters = {}) {
  const where = { tenantId: req.tenantId };
  if (filters.doctorId) where.doctorId = BigInt(filters.doctorId);
  if (filters.isActive !== undefined) where.isActive = filters.isActive === 'true';

  const [items, total] = await Promise.all([
    prisma.doctorRevenueRule.findMany({
      where,
      include: { doctor: { select: { id: true, firstName: true, lastName: true, specialization: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.doctorRevenueRule.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function createDoctorRevenueRule(req, data) {
  const doctor = await prisma.doctor.findFirst({ where: { id: BigInt(data.doctorId), tenantId: req.tenantId } });
  if (!doctor) throw ApiError.notFound('Doctor not found');

  return prisma.doctorRevenueRule.create({
    data: {
      tenantId: req.tenantId,
      doctorId: BigInt(data.doctorId),
      revenueType: data.revenueType,
      sharePercent: data.sharePercent || 0,
      fixedAmount: data.fixedAmount || 0,
      effectiveFrom: new Date(data.effectiveFrom),
      effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
      isActive: true,
    },
    include: { doctor: { select: { id: true, firstName: true, lastName: true } } },
  });
}

export async function listDoctorRevenueEntries(req, { page, limit, skip }, filters = {}) {
  const where = { tenantId: req.tenantId };
  if (filters.doctorId) where.doctorId = BigInt(filters.doctorId);
  if (filters.isPaid !== undefined) where.isPaid = filters.isPaid === 'true';
  if (filters.month && filters.year) {
    const from = new Date(parseInt(filters.year), parseInt(filters.month) - 1, 1);
    const to = new Date(parseInt(filters.year), parseInt(filters.month), 1);
    where.entryDate = { gte: from, lt: to };
  }

  const [items, total] = await Promise.all([
    prisma.doctorRevenueEntry.findMany({
      where,
      include: { doctor: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { entryDate: 'desc' },
      skip,
      take: limit,
    }),
    prisma.doctorRevenueEntry.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function createDoctorRevenueEntry(req, data) {
  return prisma.doctorRevenueEntry.create({
    data: {
      tenantId: req.tenantId,
      doctorId: BigInt(data.doctorId),
      ruleId: data.ruleId ? BigInt(data.ruleId) : null,
      billId: data.billId ? BigInt(data.billId) : null,
      revenueType: data.revenueType,
      grossAmount: data.grossAmount,
      shareAmount: data.shareAmount,
      entryDate: new Date(data.entryDate || Date.now()),
      notes: data.notes || null,
    },
    include: { doctor: { select: { id: true, firstName: true, lastName: true } } },
  });
}

export async function markRevenueEntryPaid(req, id) {
  const entry = await prisma.doctorRevenueEntry.findFirst({ where: { id: BigInt(id), tenantId: req.tenantId } });
  if (!entry) throw ApiError.notFound('Revenue entry not found');
  return prisma.doctorRevenueEntry.update({
    where: { id: BigInt(id) },
    data: { isPaid: true, paidAt: new Date() },
  });
}

// ── INCENTIVES ────────────────────────────────────────────────────────────────

export const incentiveRuleService = createCrudService('incentiveRule', {
  searchFields: ['name'],
  moduleName: 'incentives',
  entityLabel: 'Incentive Rule',
  softDelete: false,
});

export async function listIncentiveEntries(req, { page, limit, skip }, filters = {}) {
  const where = { tenantId: req.tenantId };
  if (filters.employeeId) where.employeeId = BigInt(filters.employeeId);
  if (filters.month) where.month = parseInt(filters.month);
  if (filters.year) where.year = parseInt(filters.year);
  if (filters.isPaid !== undefined) where.isPaid = filters.isPaid === 'true';

  const [items, total] = await Promise.all([
    prisma.incentiveEntry.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        rule: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.incentiveEntry.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function createIncentiveEntry(req, data) {
  const employee = await prisma.employee.findFirst({ where: { id: BigInt(data.employeeId), tenantId: req.tenantId } });
  if (!employee) throw ApiError.notFound('Employee not found');

  return prisma.incentiveEntry.create({
    data: {
      tenantId: req.tenantId,
      employeeId: BigInt(data.employeeId),
      ruleId: data.ruleId ? BigInt(data.ruleId) : null,
      month: data.month,
      year: data.year,
      amount: data.amount,
      reason: data.reason || null,
    },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function markIncentivePaid(req, id) {
  const entry = await prisma.incentiveEntry.findFirst({ where: { id: BigInt(id), tenantId: req.tenantId } });
  if (!entry) throw ApiError.notFound('Incentive entry not found');
  return prisma.incentiveEntry.update({ where: { id: BigInt(id) }, data: { isPaid: true } });
}

// ── LOANS ─────────────────────────────────────────────────────────────────────

export async function listLoans(req, { page, limit, skip }, filters = {}) {
  const where = { tenantId: req.tenantId };
  if (filters.employeeId) where.employeeId = BigInt(filters.employeeId);
  if (filters.status) where.status = filters.status;

  const [items, total] = await Promise.all([
    prisma.employeeLoan.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        repayments: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.employeeLoan.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function createLoan(req, data) {
  const employee = await prisma.employee.findFirst({ where: { id: BigInt(data.employeeId), tenantId: req.tenantId } });
  if (!employee) throw ApiError.notFound('Employee not found');

  const loan = await prisma.employeeLoan.create({
    data: {
      tenantId: req.tenantId,
      employeeId: BigInt(data.employeeId),
      loanType: data.loanType,
      principalAmount: data.principalAmount,
      interestRate: data.interestRate || 0,
      tenure: data.tenure,
      emiAmount: data.emiAmount,
      disbursedAt: data.disbursedAt ? new Date(data.disbursedAt) : null,
      notes: data.notes || null,
    },
  });

  // auto-create repayment schedule
  const repayments = [];
  for (let i = 1; i <= data.tenure; i++) {
    const dueDate = new Date(data.disbursedAt || Date.now());
    dueDate.setMonth(dueDate.getMonth() + i);
    repayments.push({ loanId: loan.id, installmentNo: i, dueDate, amount: data.emiAmount });
  }
  if (repayments.length > 0) {
    await prisma.loanRepayment.createMany({ data: repayments });
  }

  return prisma.employeeLoan.findFirst({
    where: { id: loan.id },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true } },
      repayments: { orderBy: { installmentNo: 'asc' } },
    },
  });
}

export async function markRepaymentPaid(req, repaymentId) {
  const repayment = await prisma.loanRepayment.findFirst({
    where: { id: BigInt(repaymentId) },
    include: { loan: true },
  });
  if (!repayment) throw ApiError.notFound('Repayment not found');
  if (repayment.loan.tenantId !== req.tenantId) throw ApiError.forbidden();

  return prisma.loanRepayment.update({
    where: { id: BigInt(repaymentId) },
    data: { isPaid: true, paidDate: new Date() },
  });
}

// ── RECRUITMENT ───────────────────────────────────────────────────────────────

export async function listJobPostings(req, { page, limit, skip }, filters = {}) {
  const where = { tenantId: req.tenantId };
  if (filters.status) where.status = filters.status;
  if (filters.departmentId) where.departmentId = BigInt(filters.departmentId);

  const [items, total] = await Promise.all([
    prisma.jobPosting.findMany({
      where,
      include: {
        _count: { select: { applications: true } },
      },
      orderBy: { postedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.jobPosting.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function createJobPosting(req, data) {
  return prisma.jobPosting.create({
    data: {
      tenantId: req.tenantId,
      title: data.title,
      departmentId: data.departmentId ? BigInt(data.departmentId) : null,
      designationId: data.designationId ? BigInt(data.designationId) : null,
      description: data.description || null,
      requirements: data.requirements || null,
      vacancies: data.vacancies || 1,
      salaryMin: data.salaryMin || null,
      salaryMax: data.salaryMax || null,
      closingDate: data.closingDate ? new Date(data.closingDate) : null,
    },
  });
}

export async function listApplications(req, { page, limit, skip }, filters = {}) {
  const where = { tenantId: req.tenantId };
  if (filters.jobId) where.jobId = BigInt(filters.jobId);
  if (filters.status) where.status = filters.status;

  const [items, total] = await Promise.all([
    prisma.jobApplication.findMany({
      where,
      include: { job: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.jobApplication.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function createApplication(req, data) {
  const job = await prisma.jobPosting.findFirst({ where: { id: BigInt(data.jobId), tenantId: req.tenantId } });
  if (!job) throw ApiError.notFound('Job posting not found');
  if (job.status !== 'Open') throw ApiError.badRequest('Job posting is not open for applications');

  return prisma.jobApplication.create({
    data: {
      tenantId: req.tenantId,
      jobId: BigInt(data.jobId),
      candidateName: data.candidateName,
      email: data.email,
      phone: data.phone || null,
      resumeUrl: data.resumeUrl || null,
      coverLetter: data.coverLetter || null,
      experience: data.experience ? parseInt(data.experience) : null,
    },
    include: { job: { select: { id: true, title: true } } },
  });
}

export async function updateApplicationStatus(req, id, data) {
  const application = await prisma.jobApplication.findFirst({ where: { id: BigInt(id), tenantId: req.tenantId } });
  if (!application) throw ApiError.notFound('Application not found');

  const updateData = { status: data.status, notes: data.notes || application.notes };
  if (data.interviewDate) updateData.interviewDate = new Date(data.interviewDate);
  if (data.offerDate) updateData.offerDate = new Date(data.offerDate);
  if (data.joiningDate) updateData.joiningDate = new Date(data.joiningDate);

  return prisma.jobApplication.update({ where: { id: BigInt(id) }, data: updateData });
}

// ── PERFORMANCE REVIEW ────────────────────────────────────────────────────────

export async function listPerformanceReviews(req, { page, limit, skip }, filters = {}) {
  const where = { tenantId: req.tenantId };
  if (filters.employeeId) where.employeeId = BigInt(filters.employeeId);
  if (filters.status) where.status = filters.status;

  const [items, total] = await Promise.all([
    prisma.performanceReview.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        ratings: true,
      },
      orderBy: { reviewDate: 'desc' },
      skip,
      take: limit,
    }),
    prisma.performanceReview.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function createPerformanceReview(req, data) {
  const employee = await prisma.employee.findFirst({ where: { id: BigInt(data.employeeId), tenantId: req.tenantId } });
  if (!employee) throw ApiError.notFound('Employee not found');

  const review = await prisma.performanceReview.create({
    data: {
      tenantId: req.tenantId,
      employeeId: BigInt(data.employeeId),
      reviewerId: data.reviewerId ? BigInt(data.reviewerId) : null,
      reviewPeriod: data.reviewPeriod,
      reviewDate: new Date(data.reviewDate),
      comments: data.comments || null,
      goals: data.goals || null,
      strengths: data.strengths || null,
      improvements: data.improvements || null,
    },
  });

  if (data.ratings && Array.isArray(data.ratings)) {
    const ratingsData = data.ratings.map((r) => ({
      reviewId: review.id,
      criteria: r.criteria,
      score: r.score,
      maxScore: r.maxScore || 5,
      comments: r.comments || null,
    }));
    if (ratingsData.length > 0) {
      await prisma.performanceRating.createMany({ data: ratingsData });
    }

    const avg = data.ratings.reduce((s, r) => s + Number(r.score) / Number(r.maxScore || 5), 0) / data.ratings.length;
    await prisma.performanceReview.update({
      where: { id: review.id },
      data: { overallScore: Math.round(avg * 500) / 100 }, // normalize to 5-point scale
    });
  }

  return prisma.performanceReview.findFirst({
    where: { id: review.id },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true } },
      ratings: true,
    },
  });
}

export async function updateReviewStatus(req, id, status) {
  const review = await prisma.performanceReview.findFirst({ where: { id: BigInt(id), tenantId: req.tenantId } });
  if (!review) throw ApiError.notFound('Review not found');
  return prisma.performanceReview.update({ where: { id: BigInt(id) }, data: { status } });
}
