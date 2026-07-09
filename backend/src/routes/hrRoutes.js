import { Router } from 'express';
import Joi from 'joi';
import { createCrudRouter } from './crudRouterFactory.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, paginationMeta } from '../utils/response.js';
import { parseListQuery } from '../utils/query.js';
import { MODULES } from '../config/roles.js';
import * as hrController from '../controllers/hrController.js';
import * as hrService from '../services/hrService.js';
import * as empDocService from '../services/employeeDocumentService.js';
import {
  createDesignationSchema,
  createEmployeeSchema,
  updateEmployeeSchema,
  markAttendanceSchema,
  createLeaveTypeSchema,
  applyLeaveSchema,
  updateLeaveStatusSchema,
  generatePayrollSchema,
} from '../validations/hrValidation.js';

const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });
const uploadDocumentSchema = Joi.object({
  employeeId: Joi.number().integer().positive().required(),
  type: Joi.string().required(),
  number: Joi.string().optional().allow(''),
  expiryDate: Joi.date().optional().allow(''),
  fileUrl: Joi.string().optional().allow(''),
  notes: Joi.string().optional().allow(''),
});
const selfCheckSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).optional(),
  lng: Joi.number().min(-180).max(180).optional(),
  address: Joi.string().max(255).optional().allow(''),
});
const router = Router();

router.use('/designations', createCrudRouter(hrController.designationController, { moduleName: MODULES.HR, createSchema: createDesignationSchema, updateSchema: createDesignationSchema }));
router.use('/employees', createCrudRouter(hrController.employeeController, { moduleName: MODULES.HR, createSchema: createEmployeeSchema, updateSchema: updateEmployeeSchema }));
router.use('/leave-types', createCrudRouter(hrController.leaveTypeController, { moduleName: MODULES.HR, createSchema: createLeaveTypeSchema, updateSchema: createLeaveTypeSchema }));

router.get('/attendance', authorize(MODULES.HR, 'read'), hrController.listAttendance);
router.post('/attendance', authorize(MODULES.HR, 'manage'), validate({ body: markAttendanceSchema }), hrController.markAttendance);

// ── MOBILE ATTENDANCE APP: geo-located self check-in/out ─────────────────────
router.get('/attendance/self', asyncHandler(async (req, res) => {
  ok(res, await hrService.getSelfAttendanceStatus(req));
}));
router.post('/attendance/self-checkin', validate({ body: selfCheckSchema }), asyncHandler(async (req, res) => {
  created(res, await hrService.selfCheckIn(req, req.body));
}));
router.post('/attendance/self-checkout', validate({ body: selfCheckSchema }), asyncHandler(async (req, res) => {
  ok(res, await hrService.selfCheckOut(req, req.body));
}));

router.get('/leaves', authorize(MODULES.HR, 'read'), hrController.listLeaves);
router.post('/leaves', authorize(MODULES.HR, 'manage'), validate({ body: applyLeaveSchema }), hrController.applyLeave);
router.patch('/leaves/:id/status', authorize(MODULES.HR, 'manage'), validate({ params: idParamSchema, body: updateLeaveStatusSchema }), hrController.updateLeaveStatus);

router.get('/payroll', authorize(MODULES.HR, 'read'), hrController.listPayrolls);
router.post('/payroll', authorize(MODULES.HR, 'manage'), validate({ body: generatePayrollSchema }), hrController.generatePayroll);
router.post('/payroll/:id/mark-paid', authorize(MODULES.HR, 'manage'), validate({ params: idParamSchema }), hrController.markPayrollPaid);

// ── EMPLOYEE DOCUMENTS VAULT ──────────────────────────────────────────────────
router.get('/employee-documents', authorize(MODULES.HR, 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await empDocService.listEmployeeDocuments(req, lq, req.query);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
}));

router.get('/employee-documents/employee/:empId', authorize(MODULES.HR, 'read'), asyncHandler(async (req, res) => {
  ok(res, await empDocService.getEmployeeDocumentsForEmployee(req, req.params.empId));
}));

router.post('/employee-documents', authorize(MODULES.HR, 'manage'), validate({ body: uploadDocumentSchema }), asyncHandler(async (req, res) => {
  created(res, await empDocService.uploadEmployeeDocument(req, req.body));
}));

router.post('/employee-documents/:id/verify', authorize(MODULES.HR, 'manage'), validate({ params: idParamSchema }), asyncHandler(async (req, res) => {
  ok(res, await empDocService.verifyEmployeeDocument(req, req.params.id));
}));

router.delete('/employee-documents/:id', authorize(MODULES.HR, 'manage'), validate({ params: idParamSchema }), asyncHandler(async (req, res) => {
  ok(res, await empDocService.deleteEmployeeDocument(req, req.params.id));
}));

export default router;
