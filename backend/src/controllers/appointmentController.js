import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, paginationMeta } from '../utils/response.js';
import { parseListQuery } from '../utils/query.js';
import * as appointmentService from '../services/appointmentService.js';

export const list = asyncHandler(async (req, res) => {
  const listQuery = parseListQuery(req.query, { defaultSortBy: 'appointmentTime' });
  const { items, total, page, limit } = await appointmentService.listAppointments(req, listQuery, req.query);
  ok(res, items, paginationMeta(page, limit, total));
});

export const getById = asyncHandler(async (req, res) => {
  ok(res, await appointmentService.getAppointmentById(req, req.params.id));
});

export const create = asyncHandler(async (req, res) => {
  created(res, await appointmentService.createAppointment(req, req.body));
});

export const update = asyncHandler(async (req, res) => {
  ok(res, await appointmentService.updateAppointment(req, req.params.id, req.body));
});

export const cancel = asyncHandler(async (req, res) => {
  ok(res, await appointmentService.cancelAppointment(req, req.params.id));
});

export const checkIn = asyncHandler(async (req, res) => {
  ok(res, await appointmentService.checkIn(req, req.params.id));
});

export const remove = asyncHandler(async (req, res) => {
  ok(res, await appointmentService.removeAppointment(req, req.params.id));
});

export const doctorQueue = asyncHandler(async (req, res) => {
  ok(res, await appointmentService.getDoctorQueue(req, req.params.doctorId, req.query.date));
});
