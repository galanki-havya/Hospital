import { Router } from 'express';
import Joi from 'joi';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, paginationMeta } from '../utils/response.js';
import { parseListQuery } from '../utils/query.js';
import { MODULES } from '../config/roles.js';
import * as hrExtService from '../services/hrExtService.js';
import { createCrudRouter } from './crudRouterFactory.js';

const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });

const shiftTemplateController = {
  list: asyncHandler(async (req, res) => { const lq = parseListQuery(req.query); const r = await hrExtService.shiftTemplateService.list(req, lq); ok(res, r.items, paginationMeta(r.page, r.limit, r.total)); }),
  getById: asyncHandler(async (req, res) => ok(res, await hrExtService.shiftTemplateService.getById(req, req.params.id))),
  create: asyncHandler(async (req, res) => created(res, await hrExtService.shiftTemplateService.create(req, req.body))),
  update: asyncHandler(async (req, res) => ok(res, await hrExtService.shiftTemplateService.update(req, req.params.id, req.body))),
  remove: asyncHandler(async (req, res) => ok(res, await hrExtService.shiftTemplateService.remove(req, req.params.id))),
};

const incentiveRuleController = {
  list: asyncHandler(async (req, res) => { const lq = parseListQuery(req.query); const r = await hrExtService.incentiveRuleService.list(req, lq); ok(res, r.items, paginationMeta(r.page, r.limit, r.total)); }),
  getById: asyncHandler(async (req, res) => ok(res, await hrExtService.incentiveRuleService.getById(req, req.params.id))),
  create: asyncHandler(async (req, res) => created(res, await hrExtService.incentiveRuleService.create(req, req.body))),
  update: asyncHandler(async (req, res) => ok(res, await hrExtService.incentiveRuleService.update(req, req.params.id, req.body))),
  remove: asyncHandler(async (req, res) => ok(res, await hrExtService.incentiveRuleService.remove(req, req.params.id))),
};

const router = Router();

// ── SHIFTS ────────────────────────────────────────────────────────────────────
router.use('/shift-templates', createCrudRouter(shiftTemplateController, { moduleName: MODULES.SHIFTS }));

router.get('/shift-assignments', authorize(MODULES.SHIFTS, 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await hrExtService.listShiftAssignments(req, lq, req.query);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
}));

router.post('/shift-assignments', authorize(MODULES.SHIFTS, 'manage'), asyncHandler(async (req, res) => {
  created(res, await hrExtService.assignShift(req, req.body));
}));

// ── DOCTOR REVENUE ────────────────────────────────────────────────────────────
router.get('/doctor-revenue/rules', authorize(MODULES.DOCTOR_REVENUE, 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await hrExtService.listDoctorRevenueRules(req, lq, req.query);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
}));

router.post('/doctor-revenue/rules', authorize(MODULES.DOCTOR_REVENUE, 'manage'), asyncHandler(async (req, res) => {
  created(res, await hrExtService.createDoctorRevenueRule(req, req.body));
}));

router.get('/doctor-revenue/entries', authorize(MODULES.DOCTOR_REVENUE, 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await hrExtService.listDoctorRevenueEntries(req, lq, req.query);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
}));

router.post('/doctor-revenue/entries', authorize(MODULES.DOCTOR_REVENUE, 'manage'), asyncHandler(async (req, res) => {
  created(res, await hrExtService.createDoctorRevenueEntry(req, req.body));
}));

router.post('/doctor-revenue/entries/:id/mark-paid', authorize(MODULES.DOCTOR_REVENUE, 'manage'), validate({ params: idParamSchema }), asyncHandler(async (req, res) => {
  ok(res, await hrExtService.markRevenueEntryPaid(req, req.params.id));
}));

// ── INCENTIVES ────────────────────────────────────────────────────────────────
router.use('/incentive-rules', createCrudRouter(incentiveRuleController, { moduleName: MODULES.INCENTIVES }));

router.get('/incentive-entries', authorize(MODULES.INCENTIVES, 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await hrExtService.listIncentiveEntries(req, lq, req.query);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
}));

router.post('/incentive-entries', authorize(MODULES.INCENTIVES, 'manage'), asyncHandler(async (req, res) => {
  created(res, await hrExtService.createIncentiveEntry(req, req.body));
}));

router.post('/incentive-entries/:id/mark-paid', authorize(MODULES.INCENTIVES, 'manage'), validate({ params: idParamSchema }), asyncHandler(async (req, res) => {
  ok(res, await hrExtService.markIncentivePaid(req, req.params.id));
}));

// ── LOANS ─────────────────────────────────────────────────────────────────────
router.get('/loans', authorize(MODULES.LOANS, 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await hrExtService.listLoans(req, lq, req.query);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
}));

router.post('/loans', authorize(MODULES.LOANS, 'manage'), asyncHandler(async (req, res) => {
  created(res, await hrExtService.createLoan(req, req.body));
}));

router.post('/loans/repayments/:id/mark-paid', authorize(MODULES.LOANS, 'manage'), validate({ params: idParamSchema }), asyncHandler(async (req, res) => {
  ok(res, await hrExtService.markRepaymentPaid(req, req.params.id));
}));

// ── RECRUITMENT ───────────────────────────────────────────────────────────────
router.get('/jobs', authorize(MODULES.RECRUITMENT, 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await hrExtService.listJobPostings(req, lq, req.query);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
}));

router.post('/jobs', authorize(MODULES.RECRUITMENT, 'manage'), asyncHandler(async (req, res) => {
  created(res, await hrExtService.createJobPosting(req, req.body));
}));

router.get('/jobs/applications', authorize(MODULES.RECRUITMENT, 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await hrExtService.listApplications(req, lq, req.query);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
}));

router.post('/jobs/applications', authorize(MODULES.RECRUITMENT, 'manage'), asyncHandler(async (req, res) => {
  created(res, await hrExtService.createApplication(req, req.body));
}));

router.patch('/jobs/applications/:id/status', authorize(MODULES.RECRUITMENT, 'manage'), validate({ params: idParamSchema }), asyncHandler(async (req, res) => {
  ok(res, await hrExtService.updateApplicationStatus(req, req.params.id, req.body));
}));

// ── PERFORMANCE REVIEWS ───────────────────────────────────────────────────────
router.get('/performance', authorize(MODULES.PERFORMANCE, 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await hrExtService.listPerformanceReviews(req, lq, req.query);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
}));

router.post('/performance', authorize(MODULES.PERFORMANCE, 'manage'), asyncHandler(async (req, res) => {
  created(res, await hrExtService.createPerformanceReview(req, req.body));
}));

router.patch('/performance/:id/status', authorize(MODULES.PERFORMANCE, 'manage'), validate({ params: idParamSchema }), asyncHandler(async (req, res) => {
  ok(res, await hrExtService.updateReviewStatus(req, req.params.id, req.body.status));
}));

export default router;
