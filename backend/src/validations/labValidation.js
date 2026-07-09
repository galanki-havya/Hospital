import Joi from 'joi';

export const createLabCategorySchema = Joi.object({
  categoryName: Joi.string().trim().min(1).max(150).required(),
  description: Joi.string().trim().allow('', null),
});

export const createLabTestSchema = Joi.object({
  categoryId: Joi.number().integer().positive().allow(null),
  testCode: Joi.string().trim().max(50).allow('', null),
  testName: Joi.string().trim().min(1).max(255).required(),
  sampleType: Joi.string().trim().max(100).allow('', null),
  price: Joi.number().min(0).required(),
  turnaroundHours: Joi.number().integer().min(0).allow(null),
});

export const updateLabTestSchema = createLabTestSchema.fork(['testName', 'price'], (s) => s.optional()).min(1);

export const createLabOrderSchema = Joi.object({
  patientId: Joi.number().integer().positive().required(),
  doctorId: Joi.number().integer().positive().allow(null),
  visitId: Joi.number().integer().positive().allow(null),
  priority: Joi.string().valid('Routine', 'Urgent', 'STAT').default('Routine'),
  testIds: Joi.array().items(Joi.number().integer().positive()).min(1).required(),
});

export const updateLabOrderItemSchema = Joi.object({
  status: Joi.string().valid('Pending', 'Collected', 'Processing', 'Completed').required(),
});

export const submitResultSchema = Joi.object({
  resultValue: Joi.string().trim().max(255).required(),
  referenceRange: Joi.string().trim().max(255).allow('', null),
  remarks: Joi.string().trim().allow('', null),
});
