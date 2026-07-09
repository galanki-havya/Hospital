import { Router } from 'express';
import Joi from 'joi';
import * as emergencyController from '../controllers/emergencyController.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createEmergencyCaseSchema,
  updateEmergencyCaseSchema,
  triageSchema,
  listEmergencyQuerySchema,
} from '../validations/emergencyValidation.js';

// Reuse VISITS module permission — Emergency is a clinical workflow
const MODULE = 'visits';

const idParam = Joi.object({ id: Joi.number().integer().positive().required() });

const router = Router();

router.get('/stats', authorize(MODULE, 'read'), emergencyController.getStats);

router.get(
  '/',
  authorize(MODULE, 'read'),
  validate({ query: listEmergencyQuerySchema }),
  emergencyController.listCases
);

router.get(
  '/:id',
  authorize(MODULE, 'read'),
  validate({ params: idParam }),
  emergencyController.getCaseById
);

router.post(
  '/',
  authorize(MODULE, 'manage'),
  validate({ body: createEmergencyCaseSchema }),
  emergencyController.createCase
);

router.patch(
  '/:id',
  authorize(MODULE, 'manage'),
  validate({ params: idParam, body: updateEmergencyCaseSchema }),
  emergencyController.updateCase
);

router.post(
  '/:id/triage',
  authorize(MODULE, 'manage'),
  validate({ params: idParam, body: triageSchema }),
  emergencyController.addTriageRecord
);

export default router;
