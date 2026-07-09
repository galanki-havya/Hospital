import { Router } from 'express';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, paginationMeta } from '../utils/response.js';
import { parseListQuery } from '../utils/query.js';
import { MODULES } from '../config/roles.js';
import { createCrudRouter } from './crudRouterFactory.js';
import * as cssdService from '../services/cssdService.js';
import Joi from 'joi';

const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });

const itemController = {
  list: asyncHandler(async (req, res) => {
    const lq = parseListQuery(req.query);
    const r = await cssdService.cssdItemService.list(req, lq);
    ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
  }),
  getById: asyncHandler(async (req, res) => ok(res, await cssdService.cssdItemService.getById(req, req.params.id))),
  create: asyncHandler(async (req, res) => created(res, await cssdService.cssdItemService.create(req, req.body))),
  update: asyncHandler(async (req, res) => ok(res, await cssdService.cssdItemService.update(req, req.params.id, req.body))),
  remove: asyncHandler(async (req, res) => ok(res, await cssdService.cssdItemService.remove(req, req.params.id))),
};

const router = Router();

// Stats
router.get('/stats', authorize('cssd', 'read'), asyncHandler(async (req, res) => {
  ok(res, await cssdService.getCssdStats(req));
}));

// Items CRUD
router.use('/items', createCrudRouter(itemController, { moduleName: 'cssd' }));

// Packs
router.get('/packs', authorize('cssd', 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await cssdService.listPacks(req, lq, req.query);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
}));

router.post('/packs', authorize('cssd', 'manage'), asyncHandler(async (req, res) => {
  created(res, await cssdService.createPack(req, req.body));
}));

router.patch('/packs/:id/status', authorize('cssd', 'manage'), validate({ params: idParamSchema }), asyncHandler(async (req, res) => {
  ok(res, await cssdService.updatePackStatus(req, req.params.id, req.body.status));
}));

// Cycles
router.get('/cycles', authorize('cssd', 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await cssdService.listCycles(req, lq, req.query);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
}));

router.post('/cycles', authorize('cssd', 'manage'), asyncHandler(async (req, res) => {
  created(res, await cssdService.createCycle(req, req.body));
}));

router.post('/cycles/:id/complete', authorize('cssd', 'manage'), validate({ params: idParamSchema }), asyncHandler(async (req, res) => {
  ok(res, await cssdService.completeCycle(req, req.params.id, req.body));
}));

export default router;
