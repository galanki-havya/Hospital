import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, paginationMeta } from '../utils/response.js';
import { parseListQuery } from '../utils/query.js';
import * as patientService from '../services/patientService.js';

export const list = asyncHandler(async (req, res) => {
  const listQuery = parseListQuery(req.query);
  const { items, total, page, limit } = await patientService.listPatients(req, listQuery);
  ok(res, items, paginationMeta(page, limit, total));
});

export const getById = asyncHandler(async (req, res) => {
  ok(res, await patientService.getPatientById(req, req.params.id));
});

export const create = asyncHandler(async (req, res) => {
  created(res, await patientService.createPatient(req, req.body));
});

export const update = asyncHandler(async (req, res) => {
  ok(res, await patientService.updatePatient(req, req.params.id, req.body));
});

export const remove = asyncHandler(async (req, res) => {
  ok(res, await patientService.removePatient(req, req.params.id));
});

export const addAllergy = asyncHandler(async (req, res) => {
  created(res, await patientService.addAllergy(req, req.params.id, req.body));
});

export const removeAllergy = asyncHandler(async (req, res) => {
  ok(res, await patientService.removeAllergy(req, req.params.id, req.params.allergyId));
});

export const addMedicalHistory = asyncHandler(async (req, res) => {
  created(res, await patientService.addMedicalHistory(req, req.params.id, req.body));
});

export const timeline = asyncHandler(async (req, res) => {
  ok(res, await patientService.getPatientTimeline(req, req.params.id));
});
