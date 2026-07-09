import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, paginationMeta } from '../utils/response.js';
import { parseListQuery } from '../utils/query.js';
import * as doctorService from '../services/doctorService.js';

export const list = asyncHandler(async (req, res) => {
  const listQuery = parseListQuery(req.query);
  const extraWhere = req.query.departmentId ? { departmentId: BigInt(req.query.departmentId) } : {};
  if (req.query.status) extraWhere.status = req.query.status;
  const { items, total, page, limit } = await doctorService.listDoctors(req, listQuery, extraWhere);
  ok(res, items, paginationMeta(page, limit, total));
});

export const getById = asyncHandler(async (req, res) => {
  const doctor = await doctorService.getDoctorById(req, req.params.id);
  ok(res, doctor);
});

export const create = asyncHandler(async (req, res) => {
  const doctor = await doctorService.createDoctor(req, req.body);
  created(res, doctor);
});

export const update = asyncHandler(async (req, res) => {
  const doctor = await doctorService.updateDoctor(req, req.params.id, req.body);
  ok(res, doctor);
});

export const remove = asyncHandler(async (req, res) => {
  const result = await doctorService.removeDoctor(req, req.params.id);
  ok(res, result);
});

export const addSchedule = asyncHandler(async (req, res) => {
  const schedule = await doctorService.addSchedule(req, req.params.id, req.body);
  created(res, schedule);
});

export const listSchedules = asyncHandler(async (req, res) => {
  const schedules = await doctorService.listSchedules(req, req.params.id);
  ok(res, schedules);
});

export const removeSchedule = asyncHandler(async (req, res) => {
  const result = await doctorService.removeSchedule(req, req.params.id, req.params.scheduleId);
  ok(res, result);
});
