import { Router } from 'express';
import Joi from 'joi';
import { createCrudRouter } from './crudRouterFactory.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { MODULES } from '../config/roles.js';
import * as labController from '../controllers/labController.js';
import {
  createLabCategorySchema,
  createLabTestSchema,
  updateLabTestSchema,
  createLabOrderSchema,
  updateLabOrderItemSchema,
  submitResultSchema,
} from '../validations/labValidation.js';

const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });
const orderItemParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
  itemId: Joi.number().integer().positive().required(),
});

const router = Router();

router.use('/categories', createCrudRouter(labController.labCategoryController, { moduleName: MODULES.LAB, createSchema: createLabCategorySchema, updateSchema: createLabCategorySchema }));
router.use('/tests', createCrudRouter(labController.labTestController, { moduleName: MODULES.LAB, createSchema: createLabTestSchema, updateSchema: updateLabTestSchema }));

router.get('/orders', authorize(MODULES.LAB, 'read'), labController.listOrders);
router.get('/orders/:id', authorize(MODULES.LAB, 'read'), validate({ params: idParamSchema }), labController.getOrderById);
router.post('/orders', authorize(MODULES.LAB, 'manage'), validate({ body: createLabOrderSchema }), labController.createOrder);

router.patch(
  '/orders/:id/items/:itemId/status',
  authorize(MODULES.LAB, 'manage'),
  validate({ params: orderItemParamSchema, body: updateLabOrderItemSchema }),
  labController.updateItemStatus
);

router.post(
  '/orders/:id/items/:itemId/result',
  authorize(MODULES.LAB, 'manage'),
  validate({ params: orderItemParamSchema, body: submitResultSchema }),
  labController.submitResult
);

export default router;
