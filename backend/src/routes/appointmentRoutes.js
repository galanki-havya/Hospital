import { Router } from 'express';
import Joi from 'joi';
import * as appointmentController from '../controllers/appointmentController.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { MODULES } from '../config/roles.js';
import { createAppointmentSchema, updateAppointmentSchema, listAppointmentQuerySchema } from '../validations/appointmentValidation.js';

const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });
const doctorParamSchema = Joi.object({ doctorId: Joi.number().integer().positive().required() });
const queueQuerySchema = Joi.object({ date: Joi.date().iso() });

const router = Router();

router.get('/', authorize(MODULES.APPOINTMENTS, 'read'), validate({ query: listAppointmentQuerySchema }), appointmentController.list);
router.get('/:id', authorize(MODULES.APPOINTMENTS, 'read'), validate({ params: idParamSchema }), appointmentController.getById);
router.get(
  '/doctor/:doctorId/queue',
  authorize(MODULES.APPOINTMENTS, 'read'),
  validate({ params: doctorParamSchema, query: queueQuerySchema }),
  appointmentController.doctorQueue
);

router.post('/', authorize(MODULES.APPOINTMENTS, 'manage'), validate({ body: createAppointmentSchema }), appointmentController.create);
router.patch('/:id', authorize(MODULES.APPOINTMENTS, 'manage'), validate({ params: idParamSchema, body: updateAppointmentSchema }), appointmentController.update);
router.post('/:id/check-in', authorize(MODULES.APPOINTMENTS, 'manage'), validate({ params: idParamSchema }), appointmentController.checkIn);
router.post('/:id/cancel', authorize(MODULES.APPOINTMENTS, 'manage'), validate({ params: idParamSchema }), appointmentController.cancel);
router.delete('/:id', authorize(MODULES.APPOINTMENTS, 'manage'), validate({ params: idParamSchema }), appointmentController.remove);

export default router;
