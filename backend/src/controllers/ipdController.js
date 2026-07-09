import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, paginationMeta } from '../utils/response.js';
import { parseListQuery } from '../utils/query.js';
import { createCrudController } from './crudControllerFactory.js';
import { wardService, roomService, bedService } from '../services/ipdService.js';
import * as ipdService from '../services/ipdService.js';

export const wardController = createCrudController(wardService);
export const roomController = createCrudController(roomService, {
  buildExtraWhere: (req) => (req.query.wardId ? { wardId: BigInt(req.query.wardId) } : {}),
});
export const bedController = createCrudController(bedService, {
  buildExtraWhere: (req) => {
    const where = {};
    if (req.query.roomId) where.roomId = BigInt(req.query.roomId);
    if (req.query.status) where.status = req.query.status;
    return where;
  },
});

export const listAdmissions = asyncHandler(async (req, res) => {
  const listQuery = parseListQuery(req.query, { defaultSortBy: 'admittedAt' });
  const { items, total, page, limit } = await ipdService.listAdmissions(req, listQuery, req.query);
  ok(res, items, paginationMeta(page, limit, total));
});

export const getAdmissionById = asyncHandler(async (req, res) => {
  ok(res, await ipdService.getAdmissionById(req, req.params.id));
});

export const admitPatient = asyncHandler(async (req, res) => {
  created(res, await ipdService.admitPatient(req, req.body));
});

export const transferBed = asyncHandler(async (req, res) => {
  ok(res, await ipdService.transferBed(req, req.params.id, req.body));
});

export const dischargePatient = asyncHandler(async (req, res) => {
  ok(res, await ipdService.dischargePatient(req, req.params.id, req.body));
});

export const bedOccupancy = asyncHandler(async (req, res) => {
  ok(res, await ipdService.getBedOccupancySummary(req));
});
