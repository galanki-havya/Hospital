import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, paginationMeta } from '../utils/response.js';
import { parseListQuery } from '../utils/query.js';
import { createCrudController } from './crudControllerFactory.js';
import { designationService, employeeService, leaveTypeService } from '../services/hrService.js';
import * as hrService from '../services/hrService.js';

export const designationController = createCrudController(designationService);
export const employeeController = createCrudController(employeeService, {
  buildExtraWhere: (req) => {
    const w = {};
    if (req.query.departmentId) w.departmentId = BigInt(req.query.departmentId);
    if (req.query.status) w.status = req.query.status;
    return w;
  },
});
export const leaveTypeController = createCrudController(leaveTypeService);

export const markAttendance = asyncHandler(async (req, res) => {
  ok(res, await hrService.markAttendance(req, req.body));
});

export const listAttendance = asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const { items, total, page, limit } = await hrService.listAttendance(req, lq, req.query);
  ok(res, items, paginationMeta(page, limit, total));
});

export const applyLeave = asyncHandler(async (req, res) => {
  created(res, await hrService.applyLeave(req, req.body));
});

export const listLeaves = asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const { items, total, page, limit } = await hrService.listLeaves(req, lq, req.query);
  ok(res, items, paginationMeta(page, limit, total));
});

export const updateLeaveStatus = asyncHandler(async (req, res) => {
  ok(res, await hrService.updateLeaveStatus(req, req.params.id, req.body.status));
});

export const generatePayroll = asyncHandler(async (req, res) => {
  created(res, await hrService.generatePayroll(req, req.body));
});

export const listPayrolls = asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const { items, total, page, limit } = await hrService.listPayrolls(req, lq, req.query);
  ok(res, items, paginationMeta(page, limit, total));
});

export const markPayrollPaid = asyncHandler(async (req, res) => {
  ok(res, await hrService.markPayrollPaid(req, req.params.id));
});
