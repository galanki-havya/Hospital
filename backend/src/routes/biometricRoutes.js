import { Router } from 'express';
import Joi from 'joi';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, paginationMeta } from '../utils/response.js';
import { parseListQuery } from '../utils/query.js';
import { MODULES } from '../config/roles.js';
import * as biometric from '../services/biometricService.js';

const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });

const deviceSchema = Joi.object({
  name: Joi.string().required(),
  deviceType: Joi.string().required(),
  location: Joi.string().optional().allow(''),
  ipAddress: Joi.string().optional().allow(''),
  serialNumber: Joi.string().optional().allow(''),
});

const punchSchema = Joi.object({
  deviceId: Joi.number().integer().positive().required(),
  employeeId: Joi.number().integer().positive().optional(),
  punchType: Joi.string().valid('IN', 'OUT').required(),
  punchTime: Joi.date().optional(),
  rawUserId: Joi.string().optional().allow(''),
});

const router = Router();

router.get('/devices', authorize(MODULES.BIOMETRIC, 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await biometric.listDevices(req, lq);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
}));

router.post('/devices', authorize(MODULES.BIOMETRIC, 'manage'), validate({ body: deviceSchema }), asyncHandler(async (req, res) => {
  created(res, await biometric.addDevice(req, req.body));
}));

router.patch('/devices/:id', authorize(MODULES.BIOMETRIC, 'manage'), validate({ params: idParamSchema }), asyncHandler(async (req, res) => {
  ok(res, await biometric.updateDevice(req, req.params.id, req.body));
}));

router.delete('/devices/:id', authorize(MODULES.BIOMETRIC, 'manage'), validate({ params: idParamSchema }), asyncHandler(async (req, res) => {
  ok(res, await biometric.deleteDevice(req, req.params.id));
}));

router.post('/devices/:id/sync', authorize(MODULES.BIOMETRIC, 'manage'), validate({ params: idParamSchema }), asyncHandler(async (req, res) => {
  ok(res, await biometric.syncDevice(req, req.params.id));
}));

router.get('/logs', authorize(MODULES.BIOMETRIC, 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await biometric.listLogs(req, lq, req.query);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
}));

router.post('/logs', authorize(MODULES.BIOMETRIC, 'manage'), validate({ body: punchSchema }), asyncHandler(async (req, res) => {
  created(res, await biometric.recordPunch(req, req.body));
}));

router.get('/stats', authorize(MODULES.BIOMETRIC, 'read'), asyncHandler(async (req, res) => {
  ok(res, await biometric.getStats(req));
}));

export default router;
