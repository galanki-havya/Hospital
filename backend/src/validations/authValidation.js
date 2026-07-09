import Joi from 'joi';

export const registerTenantSchema = Joi.object({
  hospitalName: Joi.string().trim().min(2).max(255).required(),
  hospitalType: Joi.string().valid('Clinic', 'MultiSpeciality', 'SuperSpeciality').required(),
  hospitalEmail: Joi.string().trim().email({ tlds: { allow: false } }).required(),
  hospitalPhone: Joi.string().trim().max(20).allow('', null),
  adminFirstName: Joi.string().trim().min(1).max(100).required(),
  adminLastName: Joi.string().trim().max(100).allow('', null),
  adminEmail: Joi.string().trim().email({ tlds: { allow: false } }).required(),
  password: Joi.string().min(8).max(72).required(),
});

export const loginSchema = Joi.object({
  email: Joi.string().trim().email({ tlds: { allow: false } }).required(),
  password: Joi.string().required(),
  tenantCode: Joi.string().trim().max(50).allow('', null),
});

export const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).max(72).required(),
});

export const updateProfileSchema = Joi.object({
  firstName: Joi.string().trim().min(1).max(100),
  lastName: Joi.string().trim().max(100).allow('', null),
  phone: Joi.string().trim().max(20).allow('', null),
  profilePhoto: Joi.string().trim().allow('', null),
}).min(1);

export const inviteStaffSchema = Joi.object({
  email: Joi.string().trim().email({ tlds: { allow: false } }).required(),
  firstName: Joi.string().trim().min(1).max(100).required(),
  lastName: Joi.string().trim().max(100).allow('', null),
  phone: Joi.string().trim().max(20).allow('', null),
  password: Joi.string().min(8).max(72).required(),
  roleName: Joi.string()
    .valid(
      'HospitalAdmin',
      'Doctor',
      'Nurse',
      'Receptionist',
      'Pharmacist',
      'LabTechnician',
      'Radiologist',
      'Accountant',
      'HRManager',
      'StoreManager',
      'Cashier'
    )
    .required(),
});
