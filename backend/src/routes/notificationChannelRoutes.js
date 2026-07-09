import { Router } from 'express';
import { authorize } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, paginationMeta } from '../utils/response.js';
import { parseListQuery } from '../utils/query.js';
import { MODULES } from '../config/roles.js';
import { createCrudRouter } from './crudRouterFactory.js';
import * as notifService from '../services/notificationChannelService.js';
import Joi from 'joi';
import { validate } from '../middleware/validate.js';

const templateController = {
  list: asyncHandler(async (req, res) => {
    const lq = parseListQuery(req.query);
    const r = await notifService.notificationTemplateService.list(req, lq);
    ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
  }),
  getById: asyncHandler(async (req, res) => ok(res, await notifService.notificationTemplateService.getById(req, req.params.id))),
  create: asyncHandler(async (req, res) => created(res, await notifService.notificationTemplateService.create(req, req.body))),
  update: asyncHandler(async (req, res) => ok(res, await notifService.notificationTemplateService.update(req, req.params.id, req.body))),
  remove: asyncHandler(async (req, res) => ok(res, await notifService.notificationTemplateService.remove(req, req.params.id))),
};

const sendSchema = Joi.object({
  channel: Joi.string().valid('SMS', 'WhatsApp', 'Email', 'Push').required(),
  recipient: Joi.string().required(),
  subject: Joi.string().optional().allow(''),
  body: Joi.string().required(),
  entityType: Joi.string().optional().allow(''),
  entityId: Joi.number().optional(),
});

const router = Router();

router.get('/stats', authorize(MODULES.NOTIFICATIONS, 'read'), asyncHandler(async (req, res) => {
  ok(res, await notifService.getNotificationStats(req));
}));

router.use('/templates', createCrudRouter(templateController, { moduleName: MODULES.NOTIFICATIONS }));

router.get('/logs', authorize(MODULES.NOTIFICATIONS, 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await notifService.listLogs(req, lq, req.query);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
}));

router.post('/send', authorize(MODULES.NOTIFICATIONS, 'manage'), validate({ body: sendSchema }), asyncHandler(async (req, res) => {
  ok(res, await notifService.sendNotification(req, req.body));
}));

router.post('/fire-event', authorize(MODULES.NOTIFICATIONS, 'manage'), asyncHandler(async (req, res) => {
  const { eventType, variables, entityType, entityId } = req.body;
  ok(res, await notifService.fireEventNotifications(req, eventType, variables || {}, entityType, entityId));
}));

export default router;
