import Joi from 'joi';

export const createDepartmentSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150).required(),
  description: Joi.string().trim().allow('', null),
  status: Joi.string().valid('Active', 'Inactive'),
});

export const updateDepartmentSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150),
  description: Joi.string().trim().allow('', null),
  status: Joi.string().valid('Active', 'Inactive'),
}).min(1);

export const createDoctorSchema = Joi.object({
  // either link an existing user or create one inline
  email: Joi.string().trim().email({ tlds: { allow: false } }).required(),
  password: Joi.string().min(8).max(72).required(),
  firstName: Joi.string().trim().min(1).max(100).required(),
  lastName: Joi.string().trim().max(100).allow('', null),
  phone: Joi.string().trim().max(20).allow('', null),
  departmentId: Joi.number().integer().positive().allow(null),
  employeeCode: Joi.string().trim().max(50).allow('', null),
  specialization: Joi.string().trim().max(150).allow('', null),
  qualification: Joi.string().trim().max(255).allow('', null),
  consultationFee: Joi.number().min(0).allow(null),
  licenseNumber: Joi.string().trim().max(100).allow('', null),
  experienceYears: Joi.number().integer().min(0).allow(null),
});

export const updateDoctorSchema = Joi.object({
  departmentId: Joi.number().integer().positive().allow(null),
  employeeCode: Joi.string().trim().max(50).allow('', null),
  specialization: Joi.string().trim().max(150).allow('', null),
  qualification: Joi.string().trim().max(255).allow('', null),
  consultationFee: Joi.number().min(0).allow(null),
  licenseNumber: Joi.string().trim().max(100).allow('', null),
  experienceYears: Joi.number().integer().min(0).allow(null),
  status: Joi.string().valid('Active', 'Inactive'),
}).min(1);

export const createScheduleSchema = Joi.object({
  dayOfWeek: Joi.number().integer().min(0).max(6).required(),
  startTime: Joi.string()
    .pattern(/^\d{2}:\d{2}(:\d{2})?$/)
    .required(),
  endTime: Joi.string()
    .pattern(/^\d{2}:\d{2}(:\d{2})?$/)
    .required(),
  maxPatients: Joi.number().integer().min(1).allow(null),
});
