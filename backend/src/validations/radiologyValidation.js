import Joi from 'joi';

export const createRadiologyServiceSchema = Joi.object({
  serviceName: Joi.string().trim().min(1).max(255).required(),
  serviceCode: Joi.string().trim().max(100).allow('', null),
  price: Joi.number().min(0).allow(null),
});

export const updateRadiologyServiceSchema = createRadiologyServiceSchema.fork(['serviceName'], (s) => s.optional()).min(1);

export const createRadiologyOrderSchema = Joi.object({
  patientId: Joi.number().integer().positive().required(),
  doctorId: Joi.number().integer().positive().allow(null),
  visitId: Joi.number().integer().positive().allow(null),
  serviceIds: Joi.array().items(Joi.number().integer().positive()).min(1).required(),
});

export const updateOrderStatusSchema = Joi.object({
  status: Joi.string().valid('Ordered', 'Scheduled', 'Completed', 'Cancelled').required(),
});

export const createReportSchema = Joi.object({
  findings: Joi.string().trim().allow('', null),
  impression: Joi.string().trim().allow('', null),
  reportStatus: Joi.string().valid('Draft', 'Verified', 'Final').default('Draft'),
  images: Joi.array().items(Joi.object({
    url: Joi.string().uri().required(),
    label: Joi.string().max(100).allow('', null),
  })).optional(),
});
