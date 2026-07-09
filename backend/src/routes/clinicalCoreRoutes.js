import { Router } from 'express';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, paginationMeta } from '../utils/response.js';
import { parseListQuery } from '../utils/query.js';
import { MODULES } from '../config/roles.js';
import { createCrudRouter } from './crudRouterFactory.js';
import Joi from 'joi';
import * as ccs from '../services/clinicalCoreService.js';

const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });

// ── SERVICE MASTER ─────────────────────────────────────────────────────────────
export const serviceRouter = Router();

const serviceController = {
  list: asyncHandler(async (req, res) => {
    const lq = parseListQuery(req.query);
    const r = await ccs.listServices(req, lq, req.query);
    ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
  }),
  getById: asyncHandler(async (req, res) => ok(res, await ccs.serviceMasterService.getById(req, req.params.id))),
  create: asyncHandler(async (req, res) => created(res, await ccs.serviceMasterService.create(req, req.body))),
  update: asyncHandler(async (req, res) => ok(res, await ccs.serviceMasterService.update(req, req.params.id, req.body))),
  remove: asyncHandler(async (req, res) => ok(res, await ccs.serviceMasterService.remove(req, req.params.id))),
};

serviceRouter.use('/', createCrudRouter(serviceController, { moduleName: MODULES.BILLING }));

// ── ENCOUNTERS ─────────────────────────────────────────────────────────────────
export const encounterRouter = Router();

encounterRouter.get('/', authorize(MODULES.VISITS, 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await ccs.listEncounters(req, lq, req.query);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
}));

encounterRouter.get('/:id', authorize(MODULES.VISITS, 'read'), validate({ params: idParamSchema }), asyncHandler(async (req, res) => {
  ok(res, await ccs.getEncounterById(req, req.params.id));
}));

encounterRouter.post('/', authorize(MODULES.VISITS, 'manage'), asyncHandler(async (req, res) => {
  created(res, await ccs.createEncounter(req, req.body));
}));

encounterRouter.post('/:id/close', authorize(MODULES.VISITS, 'manage'), validate({ params: idParamSchema }), asyncHandler(async (req, res) => {
  ok(res, await ccs.closeEncounter(req, req.params.id));
}));

encounterRouter.get('/patient/:patientId/history', authorize(MODULES.VISITS, 'read'), asyncHandler(async (req, res) => {
  ok(res, await ccs.getPatientEncounterHistory(req, req.params.patientId));
}));

// ── CLINICAL ORDERS ─────────────────────────────────────────────────────────────
export const orderRouter = Router();

orderRouter.get('/stats', authorize(MODULES.VISITS, 'read'), asyncHandler(async (req, res) => {
  ok(res, await ccs.getOrderStats(req));
}));

orderRouter.get('/', authorize(MODULES.VISITS, 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await ccs.listOrders(req, lq, req.query);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
}));

orderRouter.post('/', authorize(MODULES.VISITS, 'manage'), asyncHandler(async (req, res) => {
  created(res, await ccs.createOrder(req, req.body));
}));

orderRouter.patch('/:id/status', authorize(MODULES.VISITS, 'manage'), validate({ params: idParamSchema }), asyncHandler(async (req, res) => {
  ok(res, await ccs.updateOrderStatus(req, req.params.id, req.body.status));
}));

// ── PAYMENT SPLITS ─────────────────────────────────────────────────────────────
export const paymentSplitRouter = Router();

paymentSplitRouter.get('/bill/:billId', authorize(MODULES.BILLING, 'read'), asyncHandler(async (req, res) => {
  ok(res, await ccs.getPaymentSplits(req, req.params.billId));
}));

paymentSplitRouter.post('/bill/:billId', authorize(MODULES.BILLING, 'manage'), asyncHandler(async (req, res) => {
  const { splits } = req.body;
  if (!splits || !Array.isArray(splits)) {
    res.status(400).json({ error: 'splits array required' }); return;
  }
  created(res, await ccs.addPaymentSplit(req, req.params.billId, splits));
}));

// ── BED STATUS ─────────────────────────────────────────────────────────────────
export const bedRouter = Router();

bedRouter.get('/live', authorize(MODULES.IPD, 'read'), asyncHandler(async (req, res) => {
  ok(res, await ccs.getLiveBedStatus(req));
}));

bedRouter.get('/:bedId/history', authorize(MODULES.IPD, 'read'), asyncHandler(async (req, res) => {
  ok(res, await ccs.getBedHistory(req, req.params.bedId));
}));

bedRouter.post('/:bedId/status', authorize(MODULES.IPD, 'manage'), asyncHandler(async (req, res) => {
  const { toStatus, patientId, admissionId, notes } = req.body;
  ok(res, await ccs.recordBedStatusChange(req, req.params.bedId, toStatus, { patientId, admissionId, notes, changedBy: req.user?.id }));
}));

// ── ENHANCED AUDIT LOG ─────────────────────────────────────────────────────────
export const auditExtRouter = Router();

auditExtRouter.get('/', authorize('audit', 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await ccs.listAuditLogs(req, lq, req.query);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
}));

auditExtRouter.post('/write', authorize('audit', 'manage'), asyncHandler(async (req, res) => {
  ok(res, await ccs.writeAuditLog(req, req.body));
}));
