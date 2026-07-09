import { Router } from 'express';
import Joi from 'joi';
import * as doctorController from '../controllers/doctorController.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { MODULES } from '../config/roles.js';
import { createDoctorSchema, updateDoctorSchema, createScheduleSchema } from '../validations/doctorValidation.js';

const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });
const scheduleParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
  scheduleId: Joi.number().integer().positive().required(),
});

const router = Router();

router.get('/', authorize(MODULES.DOCTORS, 'read'), doctorController.list);
router.get('/:id', authorize(MODULES.DOCTORS, 'read'), validate({ params: idParamSchema }), doctorController.getById);
router.post('/', authorize(MODULES.DOCTORS, 'manage'), validate({ body: createDoctorSchema }), doctorController.create);
router.patch('/:id', authorize(MODULES.DOCTORS, 'manage'), validate({ params: idParamSchema, body: updateDoctorSchema }), doctorController.update);
router.delete('/:id', authorize(MODULES.DOCTORS, 'manage'), validate({ params: idParamSchema }), doctorController.remove);

router.get('/:id/schedules', authorize(MODULES.DOCTORS, 'read'), validate({ params: idParamSchema }), doctorController.listSchedules);
router.post(
  '/:id/schedules',
  authorize(MODULES.DOCTORS, 'manage'),
  validate({ params: idParamSchema, body: createScheduleSchema }),
  doctorController.addSchedule
);
router.delete(
  '/:id/schedules/:scheduleId',
  authorize(MODULES.DOCTORS, 'manage'),
  validate({ params: scheduleParamSchema }),
  doctorController.removeSchedule
);

export default router;
