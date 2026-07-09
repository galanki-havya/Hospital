import { Router } from 'express';
import Joi from 'joi';
import * as visitController from '../controllers/visitController.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { MODULES } from '../config/roles.js';
import {
  createVisitSchema,
  vitalsSchema,
  medicalRecordSchema,
  clinicalNoteSchema,
  prescriptionSchema,
} from '../validations/visitValidation.js';

const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });

const router = Router();

router.get('/', authorize(MODULES.VISITS, 'read'), visitController.list);
router.get('/:id', authorize(MODULES.VISITS, 'read'), validate({ params: idParamSchema }), visitController.getById);
router.post('/', authorize(MODULES.VISITS, 'manage'), validate({ body: createVisitSchema }), visitController.create);
router.post('/:id/complete', authorize(MODULES.VISITS, 'manage'), validate({ params: idParamSchema }), visitController.complete);

router.post('/:id/vitals', authorize(MODULES.VISITS, 'manage'), validate({ params: idParamSchema, body: vitalsSchema }), visitController.recordVitals);
router.put(
  '/:id/medical-record',
  authorize(MODULES.VISITS, 'manage'),
  validate({ params: idParamSchema, body: medicalRecordSchema }),
  visitController.upsertMedicalRecord
);
router.post(
  '/:id/clinical-notes',
  authorize(MODULES.VISITS, 'manage'),
  validate({ params: idParamSchema, body: clinicalNoteSchema }),
  visitController.addClinicalNote
);
router.post(
  '/:id/prescriptions',
  authorize(MODULES.VISITS, 'manage'),
  validate({ params: idParamSchema, body: prescriptionSchema }),
  visitController.createPrescription
);

export default router;
