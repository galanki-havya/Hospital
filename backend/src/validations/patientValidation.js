import Joi from 'joi';

export const createPatientSchema = Joi.object({
  firstName: Joi.string().trim().min(1).max(100).required(),
  lastName: Joi.string().trim().max(100).allow('', null),
  gender: Joi.string().valid('Male', 'Female', 'Other').required(),
  dob: Joi.date().iso().allow(null),
  bloodGroup: Joi.string().trim().max(10).allow('', null),
  maritalStatus: Joi.string().trim().max(50).allow('', null),
  nationality: Joi.string().trim().max(100).allow('', null),
  occupation: Joi.string().trim().max(150).allow('', null),
  phone: Joi.string().trim().max(20).required(),
  email: Joi.string().trim().email({ tlds: { allow: false } }).allow('', null),
  address: Joi.string().trim().allow('', null),
  city: Joi.string().trim().max(100).allow('', null),
  state: Joi.string().trim().max(100).allow('', null),
  country: Joi.string().trim().max(100).allow('', null),
  emergencyContactName: Joi.string().trim().max(150).allow('', null),
  emergencyContactPhone: Joi.string().trim().max(20).allow('', null),
});

export const updatePatientSchema = createPatientSchema.fork(
  ['firstName', 'gender', 'phone'],
  (schema) => schema.optional()
).min(1);

export const createAllergySchema = Joi.object({
  allergyName: Joi.string().trim().min(1).max(255).required(),
  severity: Joi.string().trim().max(100).allow('', null),
  notes: Joi.string().trim().allow('', null),
});

export const createMedicalHistorySchema = Joi.object({
  conditionName: Joi.string().trim().min(1).max(255).required(),
  diagnosisDate: Joi.date().iso().allow(null),
  notes: Joi.string().trim().allow('', null),
});
