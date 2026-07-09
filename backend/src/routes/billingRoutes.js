import { Router } from 'express';
import Joi from 'joi';
import { createCrudRouter } from './crudRouterFactory.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { MODULES } from '../config/roles.js';
import * as billingController from '../controllers/billingController.js';
import { createBillingCategorySchema, createBillSchema, addBillItemSchema, recordPaymentSchema } from '../validations/billingValidation.js';

const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });
const router = Router();

router.use('/categories', createCrudRouter(billingController.billingCategoryController, { moduleName: MODULES.BILLING, createSchema: createBillingCategorySchema, updateSchema: createBillingCategorySchema }));

router.get('/stats', authorize(MODULES.BILLING, 'read'), billingController.revenueStats);
router.get('/', authorize(MODULES.BILLING, 'read'), billingController.listBills);
router.get('/:id', authorize(MODULES.BILLING, 'read'), validate({ params: idParamSchema }), billingController.getBillById);
router.post('/', authorize(MODULES.BILLING, 'manage'), validate({ body: createBillSchema }), billingController.createBill);
router.post('/:id/items', authorize(MODULES.BILLING, 'manage'), validate({ params: idParamSchema, body: addBillItemSchema }), billingController.addBillItem);
router.post('/:id/payments', authorize(MODULES.BILLING, 'manage'), validate({ params: idParamSchema, body: recordPaymentSchema }), billingController.recordPayment);

export default router;
