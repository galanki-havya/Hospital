import { Router } from 'express';
import Joi from 'joi';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, paginationMeta } from '../utils/response.js';
import { parseListQuery } from '../utils/query.js';
import { MODULES } from '../config/roles.js';
import * as bloodBankService from '../services/bloodBankService.js';
import { createCrudRouter } from './crudRouterFactory.js';

const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });

const addUnitSchema = Joi.object({
  donorId: Joi.number().optional(),
  bloodGroup: Joi.string().valid('APositive','ANegative','BPositive','BNegative','ABPositive','ABNegative','OPositive','ONegative').required(),
  componentType: Joi.string().required(),
  volumeMl: Joi.number().integer().required(),
  collectedAt: Joi.string().required(),
  expiresAt: Joi.string().required(),
  notes: Joi.string().optional().allow(''),
});

const donorController = {
  list: asyncHandler(async (req, res) => { const lq = parseListQuery(req.query); const r = await bloodBankService.bloodDonorService.list(req, lq); ok(res, r.items, paginationMeta(r.page, r.limit, r.total)); }),
  getById: asyncHandler(async (req, res) => ok(res, await bloodBankService.bloodDonorService.getById(req, req.params.id))),
  create: asyncHandler(async (req, res) => created(res, await bloodBankService.bloodDonorService.create(req, req.body))),
  update: asyncHandler(async (req, res) => ok(res, await bloodBankService.bloodDonorService.update(req, req.params.id, req.body))),
  remove: asyncHandler(async (req, res) => ok(res, await bloodBankService.bloodDonorService.remove(req, req.params.id))),
};

const router = Router();

router.get('/stats', authorize(MODULES.BLOOD_BANK, 'read'), asyncHandler(async (req, res) => {
  ok(res, await bloodBankService.getBloodBankStats(req));
}));

router.use('/donors', createCrudRouter(donorController, { moduleName: MODULES.BLOOD_BANK }));

router.get('/units', authorize(MODULES.BLOOD_BANK, 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await bloodBankService.listBloodUnits(req, lq, req.query);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
}));

router.post('/units', authorize(MODULES.BLOOD_BANK, 'manage'), validate({ body: addUnitSchema }), asyncHandler(async (req, res) => {
  created(res, await bloodBankService.addBloodUnit(req, req.body));
}));

router.post('/units/:id/issue', authorize(MODULES.BLOOD_BANK, 'manage'), validate({ params: idParamSchema }), asyncHandler(async (req, res) => {
  ok(res, await bloodBankService.issueBloodUnit(req, req.params.id, req.body.patientId));
}));

export default router;
