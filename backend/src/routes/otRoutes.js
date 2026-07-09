import { Router } from 'express';
import Joi from 'joi';
import { createCrudRouter } from './crudRouterFactory.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, paginationMeta } from '../utils/response.js';
import { parseListQuery } from '../utils/query.js';
import { MODULES } from '../config/roles.js';
import * as otService from '../services/otService.js';

const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });

const createScheduleSchema = Joi.object({
  patientId: Joi.number().required(),
  doctorId: Joi.number().required(),
  admissionId: Joi.number().optional(),
  otRoomId: Joi.number().optional(),
  surgeryName: Joi.string().required(),
  icdCode: Joi.string().optional().allow(''),
  scheduledDate: Joi.string().required(),
  anesthesiaType: Joi.string().valid('General','Local','Regional','Spinal','Epidural').optional(),
  anesthetistId: Joi.number().optional(),
  preOpNotes: Joi.string().optional().allow(''),
});

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('Scheduled','InProgress','Completed','Cancelled','Postponed').required(),
  postOpNotes: Joi.string().optional().allow(''),
  complications: Joi.string().optional().allow(''),
});

const router = Router();

router.use('/rooms', createCrudRouter(
  { list: asyncHandler(async (req, res) => { const lq = parseListQuery(req.query); const r = await otService.otRoomService.list(req, lq); ok(res, r.items, paginationMeta(r.page, r.limit, r.total)); }),
    getById: asyncHandler(async (req, res) => ok(res, await otService.otRoomService.getById(req, req.params.id))),
    create: asyncHandler(async (req, res) => created(res, await otService.otRoomService.create(req, req.body))),
    update: asyncHandler(async (req, res) => ok(res, await otService.otRoomService.update(req, req.params.id, req.body))),
    remove: asyncHandler(async (req, res) => ok(res, await otService.otRoomService.remove(req, req.params.id))),
  },
  { moduleName: MODULES.OT }
));

router.get('/stats', authorize(MODULES.OT, 'read'), asyncHandler(async (req, res) => {
  ok(res, await otService.getOTStats(req));
}));

router.get('/', authorize(MODULES.OT, 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await otService.listSchedules(req, lq, req.query);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
}));

router.get('/:id', authorize(MODULES.OT, 'read'), validate({ params: idParamSchema }), asyncHandler(async (req, res) => {
  ok(res, await otService.otScheduleService.getById(req, req.params.id));
}));

router.post('/', authorize(MODULES.OT, 'manage'), validate({ body: createScheduleSchema }), asyncHandler(async (req, res) => {
  created(res, await otService.otScheduleService.create(req, req.body));
}));

router.patch('/:id', authorize(MODULES.OT, 'manage'), validate({ params: idParamSchema }), asyncHandler(async (req, res) => {
  ok(res, await otService.otScheduleService.update(req, req.params.id, req.body));
}));

router.patch('/:id/status', authorize(MODULES.OT, 'manage'), validate({ params: idParamSchema, body: updateStatusSchema }), asyncHandler(async (req, res) => {
  ok(res, await otService.updateStatus(req, req.params.id, req.body.status, req.body.postOpNotes));
}));

export default router;
