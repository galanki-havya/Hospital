import Joi from 'joi';

export const platformLoginSchema = Joi.object({
  email: Joi.string().trim().email({ tlds: { allow: false } }).required(),
  password: Joi.string().required(),
});

export const platformRefreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

export const platformChangePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).max(72).required(),
});

export const createHospitalSchema = Joi.object({
  hospitalName: Joi.string().trim().min(2).max(255).required(),
  hospitalType: Joi.string().valid('Clinic', 'MultiSpeciality', 'SuperSpeciality').required(),
  hospitalEmail: Joi.string().trim().email({ tlds: { allow: false } }).required(),
  hospitalPhone: Joi.string().trim().max(20).allow('', null),
  adminFirstName: Joi.string().trim().min(1).max(100).required(),
  adminLastName: Joi.string().trim().max(100).allow('', null),
  adminEmail: Joi.string().trim().email({ tlds: { allow: false } }).required(),
  // Optional — if omitted, a temp password is generated and returned once.
  password: Joi.string().min(8).max(72),
});

export const hospitalStatusSchema = Joi.object({
  status: Joi.string().valid('Active', 'Inactive').required(),
  reason: Joi.string().trim().max(500).allow('', null),
});

export const hospitalPlanSchema = Joi.object({
  plan: Joi.string().trim().max(50).required(),
  planExpiresAt: Joi.date().iso().allow(null),
});

export const createSuperAdminSchema = Joi.object({
  email: Joi.string().trim().email({ tlds: { allow: false } }).required(),
  firstName: Joi.string().trim().min(1).max(100).required(),
  lastName: Joi.string().trim().max(100).allow('', null),
  password: Joi.string().min(8).max(72),
});

export const superAdminStatusSchema = Joi.object({
  isActive: Joi.boolean().required(),
});

export const idParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});
