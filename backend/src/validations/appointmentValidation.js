import Joi from 'joi';

export const createAppointmentSchema = Joi.object({
  patientId: Joi.number().integer().positive().required(),
  doctorId: Joi.number().integer().positive().required(),
  appointmentTime: Joi.date().iso().required(),
  reason: Joi.string().trim().allow('', null),
});

export const updateAppointmentSchema = Joi.object({
  appointmentTime: Joi.date().iso(),
  reason: Joi.string().trim().allow('', null),
  status: Joi.string().valid('Scheduled', 'CheckedIn', 'Completed', 'Cancelled', 'NoShow'),
}).min(1);

export const listAppointmentQuerySchema = Joi.object({
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
  sortBy: Joi.string(),
  sortDir: Joi.string().valid('asc', 'desc'),
  search: Joi.string().allow(''),
  doctorId: Joi.number().integer().positive(),
  patientId: Joi.number().integer().positive(),
  status: Joi.string().valid('Scheduled', 'CheckedIn', 'Completed', 'Cancelled', 'NoShow'),
  date: Joi.date().iso(),
});
