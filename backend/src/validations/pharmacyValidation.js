import Joi from 'joi';

export const createSupplierSchema = Joi.object({
  supplierName: Joi.string().trim().min(1).max(255).required(),
  supplierCode: Joi.string().trim().max(50).allow('', null),
  contactPerson: Joi.string().trim().max(150).allow('', null),
  phone: Joi.string().trim().max(20).allow('', null),
  email: Joi.string().trim().email({ tlds: { allow: false } }).allow('', null),
  address: Joi.string().trim().allow('', null),
  gstNumber: Joi.string().trim().max(50).allow('', null),
});

export const updateSupplierSchema = createSupplierSchema.fork(['supplierName'], (s) => s.optional()).min(1);

export const createMedicineCategorySchema = Joi.object({
  categoryName: Joi.string().trim().min(1).max(150).required(),
  description: Joi.string().trim().allow('', null),
});

export const createMedicineSchema = Joi.object({
  categoryId: Joi.number().integer().positive().allow(null),
  medicineCode: Joi.string().trim().max(50).allow('', null),
  medicineName: Joi.string().trim().min(1).max(255).required(),
  genericName: Joi.string().trim().max(255).allow('', null),
  manufacturer: Joi.string().trim().max(255).allow('', null),
  unit: Joi.string().trim().max(50).allow('', null),
  reorderLevel: Joi.number().integer().min(0),
  gstPercentage: Joi.number().min(0).max(100).allow(null),
});

export const updateMedicineSchema = createMedicineSchema.fork(['medicineName'], (s) => s.optional()).min(1);

export const createBatchSchema = Joi.object({
  supplierId: Joi.number().integer().positive().allow(null),
  batchNumber: Joi.string().trim().max(100).required(),
  manufacturingDate: Joi.date().iso().allow(null),
  expiryDate: Joi.date().iso().required(),
  purchasePrice: Joi.number().min(0).allow(null),
  sellingPrice: Joi.number().min(0).required(),
  quantity: Joi.number().integer().min(1).required(),
});

export const createSaleSchema = Joi.object({
  patientId: Joi.number().integer().positive().allow(null),
  prescriptionId: Joi.number().integer().positive().allow(null),
  discountAmount: Joi.number().min(0).default(0),
  taxAmount: Joi.number().min(0).default(0),
  items: Joi.array()
    .items(
      Joi.object({
        medicineId: Joi.number().integer().positive().required(),
        batchId: Joi.number().integer().positive().required(),
        quantity: Joi.number().integer().min(1).required(),
        unitPrice: Joi.number().min(0).required(),
        discountAmount: Joi.number().min(0).default(0),
      })
    )
    .min(1)
    .required(),
});
