import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, paginationMeta } from '../utils/response.js';
import { parseListQuery } from '../utils/query.js';
import { createCrudController } from './crudControllerFactory.js';
import { radiologyServiceCrud } from '../services/radiologyService.js';
import * as radiologyService from '../services/radiologyService.js';

export const servicesCrudController = createCrudController(radiologyServiceCrud);

export const listOrders = asyncHandler(async (req, res) => {
  const listQuery = parseListQuery(req.query, { defaultSortBy: 'orderedAt' });
  const { items, total, page, limit } = await radiologyService.listOrders(req, listQuery, req.query);
  ok(res, items, paginationMeta(page, limit, total));
});

export const getOrderById = asyncHandler(async (req, res) => {
  ok(res, await radiologyService.getOrderById(req, req.params.id));
});

export const createOrder = asyncHandler(async (req, res) => {
  created(res, await radiologyService.createOrder(req, req.body));
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  ok(res, await radiologyService.updateOrderStatus(req, req.params.id, req.body.status));
});

export const upsertReport = asyncHandler(async (req, res) => {
  ok(res, await radiologyService.upsertReport(req, req.params.id, req.body));
});
