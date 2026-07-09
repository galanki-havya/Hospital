import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, paginationMeta } from '../utils/response.js';
import { parseListQuery } from '../utils/query.js';
import { createCrudController } from './crudControllerFactory.js';
import { labCategoryService, labTestService } from '../services/labService.js';
import * as labService from '../services/labService.js';

export const labCategoryController = createCrudController(labCategoryService);
export const labTestController = createCrudController(labTestService, {
  buildExtraWhere: (req) => (req.query.categoryId ? { categoryId: BigInt(req.query.categoryId) } : {}),
});

export const listOrders = asyncHandler(async (req, res) => {
  const listQuery = parseListQuery(req.query, { defaultSortBy: 'orderDate' });
  const { items, total, page, limit } = await labService.listLabOrders(req, listQuery, req.query);
  ok(res, items, paginationMeta(page, limit, total));
});

export const getOrderById = asyncHandler(async (req, res) => {
  ok(res, await labService.getLabOrderById(req, req.params.id));
});

export const createOrder = asyncHandler(async (req, res) => {
  created(res, await labService.createLabOrder(req, req.body));
});

export const updateItemStatus = asyncHandler(async (req, res) => {
  ok(res, await labService.updateOrderItemStatus(req, req.params.id, req.params.itemId, req.body.status));
});

export const submitResult = asyncHandler(async (req, res) => {
  created(res, await labService.submitResult(req, req.params.id, req.params.itemId, req.body));
});
