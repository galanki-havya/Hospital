import { Router } from 'express';
import Joi from 'joi';
import { createCrudRouter } from './crudRouterFactory.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, paginationMeta } from '../utils/response.js';
import { parseListQuery } from '../utils/query.js';
import { MODULES } from '../config/roles.js';
import * as insuranceService from '../services/insuranceService.js';

const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });

const createClaimSchema = Joi.object({
  payerId: Joi.number().required(),
  patientId: Joi.number().required(),
  billId: Joi.number().optional(),
  admissionId: Joi.number().optional(),
  policyNumber: Joi.string().optional().allow(''),
  policyHolder: Joi.string().optional().allow(''),
  claimedAmount: Joi.number().positive().required(),
  notes: Joi.string().optional().allow(''),
});

const updateClaimStatusSchema = Joi.object({
  status: Joi.string().valid('Draft','Submitted','UnderReview','Approved','Rejected','Settled','PartiallyApproved').required(),
  approvedAmount: Joi.number().optional(),
  settledAmount: Joi.number().optional(),
  rejectionReason: Joi.string().optional().allow(''),
});

const payerController = {
  list: asyncHandler(async (req, res) => { const lq = parseListQuery(req.query); const r = await insuranceService.insurancePayerService.list(req, lq); ok(res, r.items, paginationMeta(r.page, r.limit, r.total)); }),
  getById: asyncHandler(async (req, res) => ok(res, await insuranceService.insurancePayerService.getById(req, req.params.id))),
  create: asyncHandler(async (req, res) => created(res, await insuranceService.insurancePayerService.create(req, req.body))),
  update: asyncHandler(async (req, res) => ok(res, await insuranceService.insurancePayerService.update(req, req.params.id, req.body))),
  remove: asyncHandler(async (req, res) => ok(res, await insuranceService.insurancePayerService.remove(req, req.params.id))),
};

const router = Router();

router.use('/payers', createCrudRouter(payerController, { moduleName: MODULES.INSURANCE }));

router.get('/stats', authorize(MODULES.INSURANCE, 'read'), asyncHandler(async (req, res) => {
  ok(res, await insuranceService.getClaimStats(req));
}));

router.get('/claims', authorize(MODULES.INSURANCE, 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await insuranceService.listClaims(req, lq, req.query);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
}));

router.post('/claims', authorize(MODULES.INSURANCE, 'manage'), validate({ body: createClaimSchema }), asyncHandler(async (req, res) => {
  created(res, await insuranceService.createClaim(req, req.body));
}));

router.patch('/claims/:id/status', authorize(MODULES.INSURANCE, 'manage'), validate({ params: idParamSchema, body: updateClaimStatusSchema }), asyncHandler(async (req, res) => {
  ok(res, await insuranceService.updateClaimStatus(req, req.params.id, req.body));
}));

export default router;
