import Joi from 'joi';

export const createVisitSchema = Joi.object({
  patientId: Joi.number().integer().positive().required(),
  doctorId: Joi.number().integer().positive().required(),
  appointmentId: Joi.number().integer().positive().allow(null),
  visitType: Joi.string().valid('OPD', 'IPD', 'Emergency').required(),
});

export const vitalsSchema = Joi.object({
  temperature: Joi.number().min(20).max(50).allow(null),
  pulseRate: Joi.number().integer().min(0).max(300).allow(null),
  respiratoryRate: Joi.number().integer().min(0).max(120).allow(null),
  bloodPressure: Joi.string().trim().max(50).allow('', null),
  oxygenSaturation: Joi.number().min(0).max(100).allow(null),
  height: Joi.number().min(0).max(300).allow(null),
  weight: Joi.number().min(0).max(500).allow(null),
});

export const medicalRecordSchema = Joi.object({
  diagnosis: Joi.string().trim().allow('', null),
  treatmentPlan: Joi.string().trim().allow('', null),
  notes: Joi.string().trim().allow('', null),
});

export const clinicalNoteSchema = Joi.object({
  notes: Joi.string().trim().min(1).required(),
});

export const prescriptionSchema = Joi.object({
  instructions: Joi.string().trim().allow('', null),
  items: Joi.array()
    .items(
      Joi.object({
        medicineId: Joi.number().integer().positive().allow(null),
        medicineName: Joi.string().trim().max(255).required(),
        dosage: Joi.string().trim().max(100).allow('', null),
        frequency: Joi.string().trim().max(100).allow('', null),
        durationDays: Joi.number().integer().min(1).allow(null),
        instructions: Joi.string().trim().allow('', null),
      })
    )
    .min(1)
    .required(),
});
