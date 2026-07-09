import { Router } from 'express';
import Joi from 'joi';
import { createCrudRouter } from './crudRouterFactory.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { MODULES } from '../config/roles.js';
import * as radiologyController from '../controllers/radiologyController.js';
import {
  createRadiologyServiceSchema,
  updateRadiologyServiceSchema,
  createRadiologyOrderSchema,
  updateOrderStatusSchema,
  createReportSchema,
} from '../validations/radiologyValidation.js';

const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });
const router = Router();

router.use(
  '/services',
  createCrudRouter(radiologyController.servicesCrudController, {
    moduleName: MODULES.RADIOLOGY,
    createSchema: createRadiologyServiceSchema,
    updateSchema: updateRadiologyServiceSchema,
  })
);

router.get('/orders', authorize(MODULES.RADIOLOGY, 'read'), radiologyController.listOrders);
router.get('/orders/:id', authorize(MODULES.RADIOLOGY, 'read'), validate({ params: idParamSchema }), radiologyController.getOrderById);
router.post('/orders', authorize(MODULES.RADIOLOGY, 'manage'), validate({ body: createRadiologyOrderSchema }), radiologyController.createOrder);
router.patch(
  '/orders/:id/status',
  authorize(MODULES.RADIOLOGY, 'manage'),
  validate({ params: idParamSchema, body: updateOrderStatusSchema }),
  radiologyController.updateOrderStatus
);
router.put(
  '/orders/:id/report',
  authorize(MODULES.RADIOLOGY, 'manage'),
  validate({ params: idParamSchema, body: createReportSchema }),
  radiologyController.upsertReport
);

export default router;
