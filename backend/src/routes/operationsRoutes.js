import { Router } from 'express';
import Joi from 'joi';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, paginationMeta } from '../utils/response.js';
import { parseListQuery } from '../utils/query.js';
import { MODULES } from '../config/roles.js';
import * as ops from '../services/operationsService.js';
import { createCrudRouter } from './crudRouterFactory.js';

const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });

// ── Diet / Kitchen ────────────────────────────────────────────────────────────
export const dietRouter = Router();

const dietPlanController = {
  list: asyncHandler(async (req, res) => { const lq = parseListQuery(req.query); const r = await ops.dietPlanService.list(req, lq); ok(res, r.items, paginationMeta(r.page, r.limit, r.total)); }),
  getById: asyncHandler(async (req, res) => ok(res, await ops.dietPlanService.getById(req, req.params.id))),
  create: asyncHandler(async (req, res) => created(res, await ops.dietPlanService.create(req, req.body))),
  update: asyncHandler(async (req, res) => ok(res, await ops.dietPlanService.update(req, req.params.id, req.body))),
  remove: asyncHandler(async (req, res) => ok(res, await ops.dietPlanService.remove(req, req.params.id))),
};

dietRouter.use('/plans', createCrudRouter(dietPlanController, { moduleName: MODULES.DIET }));

dietRouter.get('/assignments', authorize(MODULES.DIET, 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await ops.listDietAssignments(req, lq, req.query);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
}));

dietRouter.post('/assignments', authorize(MODULES.DIET, 'manage'), asyncHandler(async (req, res) => {
  created(res, await ops.assignDiet(req, req.body));
}));

// ── Ambulance ─────────────────────────────────────────────────────────────────
export const ambulanceRouter = Router();

const ambulanceController = {
  list: asyncHandler(async (req, res) => { const lq = parseListQuery(req.query); const r = await ops.ambulanceService.list(req, lq); ok(res, r.items, paginationMeta(r.page, r.limit, r.total)); }),
  getById: asyncHandler(async (req, res) => ok(res, await ops.ambulanceService.getById(req, req.params.id))),
  create: asyncHandler(async (req, res) => created(res, await ops.ambulanceService.create(req, req.body))),
  update: asyncHandler(async (req, res) => ok(res, await ops.ambulanceService.update(req, req.params.id, req.body))),
  remove: asyncHandler(async (req, res) => ok(res, await ops.ambulanceService.remove(req, req.params.id))),
};

ambulanceRouter.use('/fleet', createCrudRouter(ambulanceController, { moduleName: MODULES.AMBULANCE }));

ambulanceRouter.get('/calls', authorize(MODULES.AMBULANCE, 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await ops.listAmbulanceCalls(req, lq, req.query);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
}));

ambulanceRouter.post('/calls', authorize(MODULES.AMBULANCE, 'manage'), asyncHandler(async (req, res) => {
  created(res, await ops.createAmbulanceCall(req, req.body));
}));

ambulanceRouter.patch('/calls/:id', authorize(MODULES.AMBULANCE, 'manage'), validate({ params: idParamSchema }), asyncHandler(async (req, res) => {
  ok(res, await ops.updateAmbulanceCall(req, req.params.id, req.body));
}));

// ── Visitor Management ────────────────────────────────────────────────────────
export const visitorRouter = Router();

visitorRouter.get('/', authorize(MODULES.VISITORS, 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await ops.listVisitors(req, lq, req.query);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
}));

visitorRouter.post('/check-in', authorize(MODULES.VISITORS, 'manage'), asyncHandler(async (req, res) => {
  created(res, await ops.checkInVisitor(req, req.body));
}));

visitorRouter.patch('/:id/check-out', authorize(MODULES.VISITORS, 'manage'), validate({ params: idParamSchema }), asyncHandler(async (req, res) => {
  ok(res, await ops.checkOutVisitor(req, req.params.id));
}));

// ── Complaints / Feedback ─────────────────────────────────────────────────────
export const complaintRouter = Router();

complaintRouter.get('/stats', authorize(MODULES.COMPLAINTS, 'read'), asyncHandler(async (req, res) => {
  ok(res, await ops.getComplaintStats(req));
}));

complaintRouter.get('/', authorize(MODULES.COMPLAINTS, 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await ops.listComplaints(req, lq, req.query);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
}));

complaintRouter.post('/', authorize(MODULES.COMPLAINTS, 'manage'), asyncHandler(async (req, res) => {
  created(res, await ops.createComplaint(req, req.body));
}));

complaintRouter.patch('/:id', authorize(MODULES.COMPLAINTS, 'manage'), validate({ params: idParamSchema }), asyncHandler(async (req, res) => {
  ok(res, await ops.updateComplaint(req, req.params.id, req.body));
}));

// ── Mortuary ──────────────────────────────────────────────────────────────────
export const mortuaryRouter = Router();

mortuaryRouter.get('/', authorize(MODULES.MORTUARY, 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await ops.listMortuaryRecords(req, lq, req.query);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
}));

mortuaryRouter.post('/', authorize(MODULES.MORTUARY, 'manage'), asyncHandler(async (req, res) => {
  created(res, await ops.createMortuaryRecord(req, req.body));
}));

mortuaryRouter.patch('/:id/release', authorize(MODULES.MORTUARY, 'manage'), validate({ params: idParamSchema }), asyncHandler(async (req, res) => {
  ok(res, await ops.releaseMortuaryRecord(req, req.params.id, req.body));
}));

// ── Document Vault ────────────────────────────────────────────────────────────
export const documentRouter = Router();

documentRouter.get('/', authorize(MODULES.DOCUMENTS, 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await ops.listDocuments(req, lq, req.query);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
}));

documentRouter.post('/', authorize(MODULES.DOCUMENTS, 'manage'), asyncHandler(async (req, res) => {
  created(res, await ops.createDocument(req, req.body));
}));

documentRouter.patch('/:id/verify', authorize(MODULES.DOCUMENTS, 'manage'), validate({ params: idParamSchema }), asyncHandler(async (req, res) => {
  ok(res, await ops.verifyDocument(req, req.params.id));
}));

// ── Letters / NOC ─────────────────────────────────────────────────────────────
export const letterRouter = Router();

const letterTemplateController = {
  list: asyncHandler(async (req, res) => { const lq = parseListQuery(req.query); const r = await ops.letterTemplateService.list(req, lq); ok(res, r.items, paginationMeta(r.page, r.limit, r.total)); }),
  getById: asyncHandler(async (req, res) => ok(res, await ops.letterTemplateService.getById(req, req.params.id))),
  create: asyncHandler(async (req, res) => created(res, await ops.letterTemplateService.create(req, req.body))),
  update: asyncHandler(async (req, res) => ok(res, await ops.letterTemplateService.update(req, req.params.id, req.body))),
  remove: asyncHandler(async (req, res) => ok(res, await ops.letterTemplateService.remove(req, req.params.id))),
};

letterRouter.use('/templates', createCrudRouter(letterTemplateController, { moduleName: MODULES.LETTERS }));

letterRouter.get('/issuances', authorize(MODULES.LETTERS, 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await ops.listIssuances(req, lq, req.query);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
}));

letterRouter.post('/templates/:id/issue', authorize(MODULES.LETTERS, 'manage'), validate({ params: idParamSchema }), asyncHandler(async (req, res) => {
  created(res, await ops.issueLetterFromTemplate(req, req.params.id, req.body));
}));

// ── QR Check-in ───────────────────────────────────────────────────────────────
export const qrRouter = Router();

qrRouter.post('/generate', authorize(MODULES.QR, 'manage'), asyncHandler(async (req, res) => {
  created(res, await ops.generateQR(req, req.body));
}));

qrRouter.post('/verify', authorize(MODULES.QR, 'read'), asyncHandler(async (req, res) => {
  ok(res, await ops.verifyQRToken(req, req.body.token));
}));
