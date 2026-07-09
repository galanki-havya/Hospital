import Joi from 'joi';

export const createWardSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  wardType: Joi.string().valid('General', 'SemiPrivate', 'Private', 'ICU', 'NICU', 'PICU', 'CCU').required(),
  floorNumber: Joi.number().integer().allow(null),
});

export const updateWardSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100),
  wardType: Joi.string().valid('General', 'SemiPrivate', 'Private', 'ICU', 'NICU', 'PICU', 'CCU'),
  floorNumber: Joi.number().integer().allow(null),
  status: Joi.string().valid('Active', 'Inactive'),
}).min(1);

export const createRoomSchema = Joi.object({
  wardId: Joi.number().integer().positive().required(),
  roomNumber: Joi.string().trim().max(50).required(),
  roomType: Joi.string().valid('General', 'Private', 'Deluxe', 'ICU').required(),
});

export const updateRoomSchema = Joi.object({
  roomNumber: Joi.string().trim().max(50),
  roomType: Joi.string().valid('General', 'Private', 'Deluxe', 'ICU'),
  status: Joi.string().valid('Available', 'Occupied', 'Maintenance'),
}).min(1);

export const createBedSchema = Joi.object({
  roomId: Joi.number().integer().positive().required(),
  bedNumber: Joi.string().trim().max(50).required(),
});

export const updateBedSchema = Joi.object({
  bedNumber: Joi.string().trim().max(50),
  status: Joi.string().valid('Available', 'Occupied', 'Reserved', 'Maintenance'),
}).min(1);

export const createAdmissionSchema = Joi.object({
  patientId: Joi.number().integer().positive().required(),
  visitId: Joi.number().integer().positive().allow(null),
  bedId: Joi.number().integer().positive().required(),
  admittingDoctorId: Joi.number().integer().positive().allow(null),
  admissionReason: Joi.string().trim().allow('', null),
  expectedDischargeDate: Joi.date().iso().allow(null),
});

export const transferBedSchema = Joi.object({
  toBedId: Joi.number().integer().positive().required(),
  transferReason: Joi.string().trim().allow('', null),
});

export const dischargeSchema = Joi.object({
  dischargeSummary: Joi.string().trim().allow('', null),
  followupDate: Joi.date().iso().allow(null),
});
