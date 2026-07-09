import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, paginationMeta } from '../utils/response.js';
import * as platformService from '../services/platformService.js';

export const listHospitals = asyncHandler(async (req, res) => {
  const { items, total, page, limit } = await platformService.listHospitals(req.query);
  ok(res, items, paginationMeta(page, limit, total));
});

export const getHospital = asyncHandler(async (req, res) => {
  const result = await platformService.getHospital(req.params.id);
  ok(res, result);
});

export const getStats = asyncHandler(async (req, res) => {
  const result = await platformService.getStats();
  ok(res, result);
});

export const createHospital = asyncHandler(async (req, res) => {
  const result = await platformService.createHospital(req, req.body);
  created(res, result);
});

export const setHospitalStatus = asyncHandler(async (req, res) => {
  const result = await platformService.setHospitalStatus(req, req.params.id, req.body.status, req.body.reason);
  ok(res, result);
});

export const setHospitalPlan = asyncHandler(async (req, res) => {
  const result = await platformService.setHospitalPlan(req, req.params.id, req.body.plan, req.body.planExpiresAt);
  ok(res, result);
});

export const resetHospitalAdminPassword = asyncHandler(async (req, res) => {
  const result = await platformService.resetHospitalAdminPassword(req, req.params.id);
  ok(res, result);
});

export const createSuperAdmin = asyncHandler(async (req, res) => {
  const result = await platformService.createSuperAdmin(req, req.body);
  created(res, result);
});

export const listSuperAdmins = asyncHandler(async (req, res) => {
  const result = await platformService.listSuperAdmins();
  ok(res, result);
});

export const setSuperAdminStatus = asyncHandler(async (req, res) => {
  const result = await platformService.setSuperAdminStatus(req, req.params.id, req.body.isActive);
  ok(res, result);
});

export const listAuditLogs = asyncHandler(async (req, res) => {
  const { items, total, page, limit } = await platformService.listPlatformAuditLogs(req.query);
  ok(res, items, paginationMeta(page, limit, total));
});
