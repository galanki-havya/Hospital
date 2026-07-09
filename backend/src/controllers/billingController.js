import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, paginationMeta } from '../utils/response.js';
import { parseListQuery } from '../utils/query.js';
import { createCrudController } from './crudControllerFactory.js';
import { billingCategoryService } from '../services/billingService.js';
import * as billingService from '../services/billingService.js';

export const billingCategoryController = createCrudController(billingCategoryService);

export const listBills = asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query, { defaultSortBy: 'billDate' });
  const { items, total, page, limit } = await billingService.listBills(req, lq, req.query);
  ok(res, items, paginationMeta(page, limit, total));
});

export const getBillById = asyncHandler(async (req, res) => {
  ok(res, await billingService.getBillById(req, req.params.id));
});

export const createBill = asyncHandler(async (req, res) => {
  created(res, await billingService.createBill(req, req.body));
});

export const addBillItem = asyncHandler(async (req, res) => {
  created(res, await billingService.addBillItem(req, req.params.id, req.body));
});

export const recordPayment = asyncHandler(async (req, res) => {
  ok(res, await billingService.recordPayment(req, req.params.id, req.body));
});

export const revenueStats = asyncHandler(async (req, res) => {
  ok(res, await billingService.getRevenueStats(req));
});
