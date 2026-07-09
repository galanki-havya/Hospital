import { Router } from 'express';
import Joi from 'joi';
import { createCrudRouter } from './crudRouterFactory.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { MODULES } from '../config/roles.js';
import * as pharmacyController from '../controllers/pharmacyController.js';
import {
  createSupplierSchema,
  updateSupplierSchema,
  createMedicineCategorySchema,
  createMedicineSchema,
  updateMedicineSchema,
  createBatchSchema,
  createSaleSchema,
} from '../validations/pharmacyValidation.js';

const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });

const router = Router();

router.use('/suppliers', createCrudRouter(pharmacyController.supplierController, { moduleName: MODULES.PHARMACY, createSchema: createSupplierSchema, updateSchema: updateSupplierSchema }));
router.use(
  '/categories',
  createCrudRouter(pharmacyController.medicineCategoryController, { moduleName: MODULES.PHARMACY, createSchema: createMedicineCategorySchema, updateSchema: createMedicineCategorySchema })
);
router.use(
  '/medicines',
  createCrudRouter(pharmacyController.medicineController, { moduleName: MODULES.PHARMACY, createSchema: createMedicineSchema, updateSchema: updateMedicineSchema })
);

router.get('/medicines/:id/batches', authorize(MODULES.PHARMACY, 'read'), validate({ params: idParamSchema }), pharmacyController.listBatches);
router.post(
  '/medicines/:id/batches',
  authorize(MODULES.PHARMACY, 'manage'),
  validate({ params: idParamSchema, body: createBatchSchema }),
  pharmacyController.createBatch
);

router.get('/alerts', authorize(MODULES.PHARMACY, 'read'), pharmacyController.stockAlerts);

router.get('/sales', authorize(MODULES.PHARMACY, 'read'), pharmacyController.listSales);
router.get('/sales/:id', authorize(MODULES.PHARMACY, 'read'), validate({ params: idParamSchema }), pharmacyController.getSaleById);
router.post('/sales', authorize(MODULES.PHARMACY, 'manage'), validate({ body: createSaleSchema }), pharmacyController.createSale);

export default router;
