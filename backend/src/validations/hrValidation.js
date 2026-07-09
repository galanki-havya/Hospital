import Joi from 'joi';

export const createDesignationSchema = Joi.object({
  designationName: Joi.string().trim().min(1).max(150).required(),
  description: Joi.string().trim().allow('', null),
  status: Joi.string().valid('Active', 'Inactive'),
});

export const createEmployeeSchema = Joi.object({
  employeeCode: Joi.string().trim().min(1).max(50).required(),
  firstName: Joi.string().trim().min(1).max(100).required(),
  lastName: Joi.string().trim().max(100).allow('', null),
  gender: Joi.string().valid('Male', 'Female', 'Other').allow(null),
  dob: Joi.date().iso().allow(null),
  phone: Joi.string().trim().max(20).allow('', null),
  email: Joi.string().trim().email({ tlds: { allow: false } }).allow('', null),
  address: Joi.string().trim().allow('', null),
  departmentId: Joi.number().integer().positive().allow(null),
  designationId: Joi.number().integer().positive().allow(null),
  joiningDate: Joi.date().iso().allow(null),
  employmentType: Joi.string().valid('Permanent', 'Contract', 'PartTime').allow(null),
  basicSalary: Joi.number().min(0).allow(null),
  status: Joi.string().valid('Active', 'Inactive', 'Resigned'),
});

export const updateEmployeeSchema = createEmployeeSchema.fork(['employeeCode', 'firstName'], (s) => s.optional()).min(1);

export const markAttendanceSchema = Joi.object({
  employeeId: Joi.number().integer().positive().required(),
  attendanceDate: Joi.date().iso().required(),
  checkInTime: Joi.string().isoDate().allow(null),
  checkOutTime: Joi.string().isoDate().allow(null),
  status: Joi.string().valid('Present', 'Absent', 'HalfDay', 'Leave'),
});

export const createLeaveTypeSchema = Joi.object({
  leaveName: Joi.string().trim().min(1).max(100).required(),
  annualQuota: Joi.number().integer().min(1).allow(null),
});

export const applyLeaveSchema = Joi.object({
  employeeId: Joi.number().integer().positive().required(),
  leaveTypeId: Joi.number().integer().positive().required(),
  fromDate: Joi.date().iso().required(),
  toDate: Joi.date().iso().required(),
  reason: Joi.string().trim().allow('', null),
});

export const updateLeaveStatusSchema = Joi.object({
  status: Joi.string().valid('Approved', 'Rejected').required(),
});

export const generatePayrollSchema = Joi.object({
  employeeId: Joi.number().integer().positive().required(),
  payrollMonth: Joi.number().integer().min(1).max(12).required(),
  payrollYear: Joi.number().integer().min(2000).max(2100).required(),
  allowances: Joi.number().min(0).default(0),
  overtimeAmount: Joi.number().min(0).default(0),
  deductions: Joi.number().min(0).default(0),
  taxAmount: Joi.number().min(0).default(0),
});
