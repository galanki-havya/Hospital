import { Router } from 'express';
import Joi from 'joi';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, paginationMeta } from '../utils/response.js';
import { parseListQuery } from '../utils/query.js';
import { MODULES } from '../config/roles.js';
import * as inventoryService from '../services/inventoryService.js';
import { createCrudRouter } from './crudRouterFactory.js';

const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });

const categoryController = {
  list: asyncHandler(async (req, res) => { const lq = parseListQuery(req.query); const r = await inventoryService.inventoryCategoryService.list(req, lq); ok(res, r.items, paginationMeta(r.page, r.limit, r.total)); }),
  getById: asyncHandler(async (req, res) => ok(res, await inventoryService.inventoryCategoryService.getById(req, req.params.id))),
  create: asyncHandler(async (req, res) => created(res, await inventoryService.inventoryCategoryService.create(req, req.body))),
  update: asyncHandler(async (req, res) => ok(res, await inventoryService.inventoryCategoryService.update(req, req.params.id, req.body))),
  remove: asyncHandler(async (req, res) => ok(res, await inventoryService.inventoryCategoryService.remove(req, req.params.id))),
};

const itemController = {
  list: asyncHandler(async (req, res) => { const lq = parseListQuery(req.query); const r = await inventoryService.inventoryItemService.list(req, lq); ok(res, r.items, paginationMeta(r.page, r.limit, r.total)); }),
  getById: asyncHandler(async (req, res) => ok(res, await inventoryService.inventoryItemService.getById(req, req.params.id))),
  create: asyncHandler(async (req, res) => created(res, await inventoryService.inventoryItemService.create(req, req.body))),
  update: asyncHandler(async (req, res) => ok(res, await inventoryService.inventoryItemService.update(req, req.params.id, req.body))),
  remove: asyncHandler(async (req, res) => ok(res, await inventoryService.inventoryItemService.remove(req, req.params.id))),
};

const router = Router();

router.get('/stats', authorize(MODULES.INVENTORY, 'read'), asyncHandler(async (req, res) => {
  ok(res, await inventoryService.getInventoryStats(req));
}));

router.use('/categories', createCrudRouter(categoryController, { moduleName: MODULES.INVENTORY }));
router.use('/items', createCrudRouter(itemController, { moduleName: MODULES.INVENTORY }));

router.get('/items/low-stock', authorize(MODULES.INVENTORY, 'read'), asyncHandler(async (req, res) => {
  ok(res, await inventoryService.getLowStockItems(req));
}));

router.get('/purchase-orders', authorize(MODULES.INVENTORY, 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await inventoryService.listPurchaseOrders(req, lq, req.query);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
}));

router.post('/purchase-orders', authorize(MODULES.INVENTORY, 'manage'), asyncHandler(async (req, res) => {
  created(res, await inventoryService.createPurchaseOrder(req, req.body));
}));

router.post('/purchase-orders/:id/receive', authorize(MODULES.INVENTORY, 'manage'), validate({ params: idParamSchema }), asyncHandler(async (req, res) => {
  ok(res, await inventoryService.receivePurchaseOrder(req, req.params.id, req.body));
}));

export default router;
