import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import { paginationMeta } from '../utils/response.js';
import { parseListQuery } from '../utils/query.js';

/**
 * Builds standard list/get/create/update/remove Express handlers around a
 * service produced by createCrudService(). Pass `buildExtraWhere(req)` to
 * inject extra filters (e.g. ?doctorId=, ?status=) per-entity.
 */
export function createCrudController(service, { buildExtraWhere } = {}) {
  return {
    list: asyncHandler(async (req, res) => {
      const listQuery = parseListQuery(req.query);
      const extraWhere = buildExtraWhere ? buildExtraWhere(req) : {};
      const { items, total, page, limit } = await service.list(req, listQuery, extraWhere);
      ok(res, items, paginationMeta(page, limit, total));
    }),

    getById: asyncHandler(async (req, res) => {
      const record = await service.getById(req, req.params.id);
      ok(res, record);
    }),

    create: asyncHandler(async (req, res) => {
      const record = await service.create(req, req.body);
      created(res, record);
    }),

    update: asyncHandler(async (req, res) => {
      const record = await service.update(req, req.params.id, req.body);
      ok(res, record);
    }),

    remove: asyncHandler(async (req, res) => {
      const result = await service.remove(req, req.params.id);
      ok(res, result);
    }),
  };
}

export default createCrudController;
