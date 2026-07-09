import { Router } from 'express';
import Joi from 'joi';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, paginationMeta } from '../utils/response.js';
import { parseListQuery } from '../utils/query.js';
import { MODULES } from '../config/roles.js';
import * as mobileApp from '../services/mobileAppService.js';

const configSchema = Joi.object({
  appName: Joi.string().optional().allow(''),
  primaryColor: Joi.string().optional().allow(''),
  featuresEnabled: Joi.object().optional(),
  isLive: Joi.boolean().optional(),
});

const pushSchema = Joi.object({
  patientId: Joi.number().integer().positive().optional(),
  title: Joi.string().required(),
  body: Joi.string().required(),
});

const router = Router();

router.get('/config', authorize(MODULES.MOBILE_APP, 'read'), asyncHandler(async (req, res) => {
  ok(res, await mobileApp.getConfig(req));
}));

router.patch('/config', authorize(MODULES.MOBILE_APP, 'manage'), validate({ body: configSchema }), asyncHandler(async (req, res) => {
  ok(res, await mobileApp.updateConfig(req, req.body));
}));

router.get('/registrations', authorize(MODULES.MOBILE_APP, 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await mobileApp.listRegistrations(req, lq);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
}));

router.post('/push', authorize(MODULES.MOBILE_APP, 'manage'), validate({ body: pushSchema }), asyncHandler(async (req, res) => {
  created(res, await mobileApp.sendPush(req, req.body));
}));

router.get('/stats', authorize(MODULES.MOBILE_APP, 'read'), asyncHandler(async (req, res) => {
  ok(res, await mobileApp.getStats(req));
}));

router.get('/notifications', authorize(MODULES.MOBILE_APP, 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await mobileApp.listNotifications(req, lq);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
}));

export default router;
