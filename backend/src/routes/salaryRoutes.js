import { Router } from 'express';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, paginationMeta } from '../utils/response.js';
import { parseListQuery } from '../utils/query.js';
import { MODULES } from '../config/roles.js';
import Joi from 'joi';
import * as salaryService from '../services/salaryService.js';
import { createCrudRouter } from './crudRouterFactory.js';

const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });

const structureController = {
  list: asyncHandler(async (req, res) => {
    const lq = parseListQuery(req.query);
    const r = await salaryService.listStructures(req, lq);
    ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
  }),
  getById: asyncHandler(async (req, res) => ok(res, await salaryService.salaryStructureService.getById(req, req.params.id))),
  create: asyncHandler(async (req, res) => created(res, await salaryService.salaryStructureService.create(req, req.body))),
  update: asyncHandler(async (req, res) => ok(res, await salaryService.salaryStructureService.update(req, req.params.id, req.body))),
  remove: asyncHandler(async (req, res) => ok(res, await salaryService.salaryStructureService.remove(req, req.params.id))),
};

const router = Router();

// ── Salary Structures ──────────────────────────────────────────────────────
router.use('/structures', createCrudRouter(structureController, { moduleName: MODULES.HR }));

router.post('/structures/preview', authorize(MODULES.HR, 'read'), asyncHandler(async (req, res) => {
  ok(res, await salaryService.previewBreakdown(req, req.body.structureId, req.body.ctc));
}));

// ── Salary Assignments ─────────────────────────────────────────────────────
router.get('/assignments', authorize(MODULES.HR, 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const { items, total } = await salaryService.salaryStructureService.list
    ? { items: [], total: 0 }
    : { items: [], total: 0 };
  // list from DB directly
  const { default: prisma } = await import('../config/prisma.js');
  const where = { tenantId: req.tenantId };
  if (req.query.employeeId) where.employeeId = BigInt(req.query.employeeId);
  const [list, cnt] = await Promise.all([
    prisma.salaryAssignment.findMany({
      where,
      include: {
        structure: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: lq.skip,
      take: lq.limit,
    }),
    prisma.salaryAssignment.count({ where }),
  ]);
  ok(res, list, paginationMeta(lq.page, lq.limit, cnt));
}));

router.post('/assignments', authorize(MODULES.HR, 'manage'), asyncHandler(async (req, res) => {
  created(res, await salaryService.assignStructureToEmployee(req, req.body));
}));

// ── Overtime ───────────────────────────────────────────────────────────────
router.get('/overtime', authorize(MODULES.HR, 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await salaryService.listOvertimeRecords(req, lq, req.query);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
}));

router.post('/overtime', authorize(MODULES.HR, 'manage'), asyncHandler(async (req, res) => {
  created(res, await salaryService.createOvertimeRecord(req, req.body));
}));

router.post('/overtime/:id/approve', authorize(MODULES.HR, 'manage'), validate({ params: idParamSchema }), asyncHandler(async (req, res) => {
  ok(res, await salaryService.approveOvertime(req, req.params.id));
}));

// ── Statutory Register (PF / ESI / TDS) ────────────────────────────────────
router.get('/statutory', authorize(MODULES.HR, 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await salaryService.listStatutoryRegister(req, lq, req.query);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total), { totals: r.totals });
}));

router.post('/statutory/generate', authorize(MODULES.HR, 'manage'), asyncHandler(async (req, res) => {
  const { month, year } = req.body;
  if (!month || !year) { res.status(400).json({ error: 'month and year required' }); return; }
  ok(res, await salaryService.generateStatutoryRegister(req, month, year));
}));

export default router;
