import { Router } from 'express';
import Joi from 'joi';
import * as patientController from '../controllers/patientController.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { MODULES } from '../config/roles.js';
import {
  createPatientSchema,
  updatePatientSchema,
  createAllergySchema,
  createMedicalHistorySchema,
} from '../validations/patientValidation.js';

const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });
const allergyParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
  allergyId: Joi.number().integer().positive().required(),
});

const router = Router();

router.get('/', authorize(MODULES.PATIENTS, 'read'), patientController.list);
router.get('/:id', authorize(MODULES.PATIENTS, 'read'), validate({ params: idParamSchema }), patientController.getById);
router.get('/:id/timeline', authorize(MODULES.PATIENTS, 'read'), validate({ params: idParamSchema }), patientController.timeline);

router.post('/', authorize(MODULES.PATIENTS, 'manage'), validate({ body: createPatientSchema }), patientController.create);
router.patch('/:id', authorize(MODULES.PATIENTS, 'manage'), validate({ params: idParamSchema, body: updatePatientSchema }), patientController.update);
router.delete('/:id', authorize(MODULES.PATIENTS, 'manage'), validate({ params: idParamSchema }), patientController.remove);

router.post(
  '/:id/allergies',
  authorize(MODULES.PATIENTS, 'manage'),
  validate({ params: idParamSchema, body: createAllergySchema }),
  patientController.addAllergy
);
router.delete(
  '/:id/allergies/:allergyId',
  authorize(MODULES.PATIENTS, 'manage'),
  validate({ params: allergyParamSchema }),
  patientController.removeAllergy
);

router.post(
  '/:id/medical-history',
  authorize(MODULES.PATIENTS, 'manage'),
  validate({ params: idParamSchema, body: createMedicalHistorySchema }),
  patientController.addMedicalHistory
);

export default router;
