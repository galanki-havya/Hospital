import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, paginationMeta } from '../utils/response.js';
import { parseListQuery } from '../utils/query.js';
import * as visitService from '../services/visitService.js';

export const list = asyncHandler(async (req, res) => {
  const listQuery = parseListQuery(req.query, { defaultSortBy: 'visitDate' });
  const { items, total, page, limit } = await visitService.listVisits(req, listQuery, req.query);
  ok(res, items, paginationMeta(page, limit, total));
});

export const getById = asyncHandler(async (req, res) => {
  ok(res, await visitService.getVisitById(req, req.params.id));
});

export const create = asyncHandler(async (req, res) => {
  created(res, await visitService.createVisit(req, req.body));
});

export const recordVitals = asyncHandler(async (req, res) => {
  created(res, await visitService.recordVitals(req, req.params.id, req.body));
});

export const upsertMedicalRecord = asyncHandler(async (req, res) => {
  ok(res, await visitService.upsertMedicalRecord(req, req.params.id, req.body));
});

export const addClinicalNote = asyncHandler(async (req, res) => {
  created(res, await visitService.addClinicalNote(req, req.params.id, req.body));
});

export const createPrescription = asyncHandler(async (req, res) => {
  created(res, await visitService.createPrescription(req, req.params.id, req.body));
});

export const complete = asyncHandler(async (req, res) => {
  ok(res, await visitService.completeVisit(req, req.params.id));
});
