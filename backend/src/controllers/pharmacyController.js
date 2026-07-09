import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, paginationMeta } from '../utils/response.js';
import { parseListQuery } from '../utils/query.js';
import { createCrudController } from './crudControllerFactory.js';
import { supplierService, medicineCategoryService, medicineService } from '../services/pharmacyService.js';
import * as pharmacyService from '../services/pharmacyService.js';

export const supplierController = createCrudController(supplierService);
export const medicineCategoryController = createCrudController(medicineCategoryService);
export const medicineController = createCrudController(medicineService, {
  buildExtraWhere: (req) => (req.query.categoryId ? { categoryId: BigInt(req.query.categoryId) } : {}),
});

export const listBatches = asyncHandler(async (req, res) => {
  ok(res, await pharmacyService.listBatches(req, req.params.id));
});

export const createBatch = asyncHandler(async (req, res) => {
  created(res, await pharmacyService.createBatch(req, req.params.id, req.body));
});

export const stockAlerts = asyncHandler(async (req, res) => {
  ok(res, await pharmacyService.getStockAlerts(req));
});

export const listSales = asyncHandler(async (req, res) => {
  const listQuery = parseListQuery(req.query, { defaultSortBy: 'saleDate' });
  const { items, total, page, limit } = await pharmacyService.listSales(req, listQuery);
  ok(res, items, paginationMeta(page, limit, total));
});

export const getSaleById = asyncHandler(async (req, res) => {
  ok(res, await pharmacyService.getSaleById(req, req.params.id));
});

export const createSale = asyncHandler(async (req, res) => {
  created(res, await pharmacyService.createSale(req, req.body));
});
