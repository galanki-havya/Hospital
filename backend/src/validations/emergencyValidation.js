import Joi from 'joi';

export const createEmergencyCaseSchema = Joi.object({
  patientId: Joi.number().integer().positive().required(),
  severity: Joi.string().valid('Low', 'Medium', 'High', 'Critical').required(),
  chiefComplaint: Joi.string().trim().allow('', null),
  assignedDoctorId: Joi.number().integer().positive().allow(null),
  arrivalTime: Joi.date().iso().allow(null),
});

export const updateEmergencyCaseSchema = Joi.object({
  severity: Joi.string().valid('Low', 'Medium', 'High', 'Critical'),
  chiefComplaint: Joi.string().trim().allow('', null),
  assignedDoctorId: Joi.number().integer().positive().allow(null),
  status: Joi.string().valid('Waiting', 'InTreatment', 'Admitted', 'Discharged'),
}).min(1);

export const triageSchema = Joi.object({
  bloodPressure: Joi.string().trim().max(50).allow('', null),
  pulseRate: Joi.number().integer().min(0).max(300).allow(null),
  temperature: Joi.number().min(20).max(50).allow(null),
  respiratoryRate: Joi.number().integer().min(0).max(120).allow(null),
  oxygenSaturation: Joi.number().min(0).max(100).allow(null),
  notes: Joi.string().trim().allow('', null),
});

export const listEmergencyQuerySchema = Joi.object({
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
  status: Joi.string().valid('Waiting', 'InTreatment', 'Admitted', 'Discharged'),
  severity: Joi.string().valid('Low', 'Medium', 'High', 'Critical'),
  search: Joi.string().allow(''),
});
