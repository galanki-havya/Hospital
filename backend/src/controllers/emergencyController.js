import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import { paginationMeta } from '../utils/response.js';
import { parseListQuery } from '../utils/query.js';
import * as emergencyService from '../services/emergencyService.js';

export const listCases = asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query, { defaultSortBy: 'arrivalTime', defaultLimit: 30 });
  const filters = {
    status:   req.query.status   || undefined,
    severity: req.query.severity || undefined,
    search:   lq.search          || undefined,
  };
  const { items, total, page, limit } = await emergencyService.listCases(req, lq, filters);
  ok(res, items, paginationMeta(page, limit, total));
});

export const getCaseById = asyncHandler(async (req, res) => {
  ok(res, await emergencyService.getCaseById(req, req.params.id));
});

export const createCase = asyncHandler(async (req, res) => {
  created(res, await emergencyService.createCase(req, req.body));
});

export const updateCase = asyncHandler(async (req, res) => {
  ok(res, await emergencyService.updateCase(req, req.params.id, req.body));
});

export const addTriageRecord = asyncHandler(async (req, res) => {
  created(res, await emergencyService.addTriageRecord(req, req.params.id, req.body));
});

export const getStats = asyncHandler(async (req, res) => {
  ok(res, await emergencyService.getEmergencyStats(req));
});
