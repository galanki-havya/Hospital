import { Router } from 'express';
import Joi from 'joi';
import { createCrudRouter } from './crudRouterFactory.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { MODULES } from '../config/roles.js';
import * as ipdController from '../controllers/ipdController.js';
import {
  createWardSchema,
  updateWardSchema,
  createRoomSchema,
  updateRoomSchema,
  createBedSchema,
  updateBedSchema,
  createAdmissionSchema,
  transferBedSchema,
  dischargeSchema,
} from '../validations/ipdValidation.js';

const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });

const router = Router();

router.use('/wards', createCrudRouter(ipdController.wardController, { moduleName: MODULES.IPD, createSchema: createWardSchema, updateSchema: updateWardSchema }));
router.use('/rooms', createCrudRouter(ipdController.roomController, { moduleName: MODULES.IPD, createSchema: createRoomSchema, updateSchema: updateRoomSchema }));
router.use('/beds', createCrudRouter(ipdController.bedController, { moduleName: MODULES.IPD, createSchema: createBedSchema, updateSchema: updateBedSchema }));

router.get('/occupancy', authorize(MODULES.IPD, 'read'), ipdController.bedOccupancy);

router.get('/admissions', authorize(MODULES.IPD, 'read'), ipdController.listAdmissions);
router.get('/admissions/:id', authorize(MODULES.IPD, 'read'), validate({ params: idParamSchema }), ipdController.getAdmissionById);
router.post('/admissions', authorize(MODULES.IPD, 'manage'), validate({ body: createAdmissionSchema }), ipdController.admitPatient);
router.post(
  '/admissions/:id/transfer',
  authorize(MODULES.IPD, 'manage'),
  validate({ params: idParamSchema, body: transferBedSchema }),
  ipdController.transferBed
);
router.post(
  '/admissions/:id/discharge',
  authorize(MODULES.IPD, 'manage'),
  validate({ params: idParamSchema, body: dischargeSchema }),
  ipdController.dischargePatient
);

export default router;
