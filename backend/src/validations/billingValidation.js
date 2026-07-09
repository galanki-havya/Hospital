import Joi from 'joi';

export const createBillingCategorySchema = Joi.object({
  categoryName: Joi.string().trim().min(1).max(150).required(),
  description: Joi.string().trim().allow('', null),
});

export const createBillSchema = Joi.object({
  patientId: Joi.number().integer().positive().required(),
  discountAmount: Joi.number().min(0).default(0),
  taxAmount: Joi.number().min(0).default(0),
  items: Joi.array()
    .items(
      Joi.object({
        categoryId: Joi.number().integer().positive().allow(null),
        serviceName: Joi.string().trim().min(1).max(255).required(),
        quantity: Joi.number().integer().min(1).default(1),
        unitPrice: Joi.number().min(0).required(),
        discountAmount: Joi.number().min(0).default(0),
        taxAmount: Joi.number().min(0).default(0),
      })
    )
    .min(1)
    .required(),
});

export const addBillItemSchema = Joi.object({
  categoryId: Joi.number().integer().positive().allow(null),
  serviceName: Joi.string().trim().min(1).max(255).required(),
  quantity: Joi.number().integer().min(1).default(1),
  unitPrice: Joi.number().min(0).required(),
  discountAmount: Joi.number().min(0).default(0),
  taxAmount: Joi.number().min(0).default(0),
});

export const recordPaymentSchema = Joi.object({
  amount: Joi.number().min(0.01).required(),
  paymentMethod: Joi.string().valid('Cash', 'Card', 'UPI', 'NetBanking', 'Insurance').required(),
  transactionId: Joi.string().trim().max(255).allow('', null),
  paymentReference: Joi.string().trim().max(255).allow('', null),
});

export const updateBillStatusSchema = Joi.object({
  status: Joi.string().valid('Draft', 'PartiallyPaid', 'Paid', 'Cancelled').required(),
});
