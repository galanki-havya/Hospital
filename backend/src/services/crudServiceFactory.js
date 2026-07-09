import prisma from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { recordAudit } from './auditService.js';

/**
 * Builds a standard set of CRUD operations for a tenant-scoped Prisma model.
 *
 * @param {string} modelName - the Prisma client property, e.g. 'department'
 * @param {object} opts
 *   - searchFields: string[] of columns to OR-search with `contains`
 *   - include: Prisma `include` object applied to list/get/create/update
 *   - tenantScoped: boolean (default true) — whether to filter by tenantId
 *   - softDelete: boolean (default true) — whether the model has deletedAt
 *   - moduleName: string for audit logs
 *   - entityLabel: human label for audit logs (defaults to modelName)
 */
export function createCrudService(modelName, opts = {}) {
  const {
    searchFields = [],
    include = undefined,
    tenantScoped = true,
    softDelete = true,
    moduleName = modelName,
    entityLabel = modelName,
  } = opts;

  const model = prisma[modelName];
  if (!model) {
    throw new Error(`createCrudService: unknown Prisma model "${modelName}"`);
  }

  function scopeWhere(req, extraWhere = {}) {
    const where = { ...extraWhere };
    if (tenantScoped) where.tenantId = req.tenantId;
    if (softDelete) where.deletedAt = null;
    return where;
  }

  function buildSearch(search) {
    if (!search || searchFields.length === 0) return undefined;
    return {
      OR: searchFields.map((field) => ({ [field]: { contains: search } })),
    };
  }

  return {
    async list(req, { page, limit, skip, sortBy, sortDir, search }, extraWhere = {}) {
      const searchClause = buildSearch(search);
      const where = { ...scopeWhere(req, extraWhere), ...(searchClause || {}) };

      const [items, total] = await Promise.all([
        model.findMany({ where, include, orderBy: { [sortBy]: sortDir }, skip, take: limit }),
        model.count({ where }),
      ]);

      return { items, total, page, limit };
    },

    async getById(req, id) {
      const record = await model.findFirst({ where: scopeWhere(req, { id: BigInt(id) }), include });
      if (!record) throw ApiError.notFound(`${entityLabel} not found`);
      return record;
    },

    async create(req, data) {
      const payload = tenantScoped ? { ...data, tenantId: req.tenantId } : data;
      const record = await model.create({ data: payload, include });
      await recordAudit({
        req,
        moduleName,
        actionType: 'CREATE',
        entityName: modelName,
        entityId: record.id,
        newValues: data,
      });
      return record;
    },

    async update(req, id, data) {
      const existing = await model.findFirst({ where: scopeWhere(req, { id: BigInt(id) }) });
      if (!existing) throw ApiError.notFound(`${entityLabel} not found`);

      const record = await model.update({ where: { id: BigInt(id) }, data, include });
      await recordAudit({
        req,
        moduleName,
        actionType: 'UPDATE',
        entityName: modelName,
        entityId: record.id,
        oldValues: existing,
        newValues: data,
      });
      return record;
    },

    async remove(req, id) {
      const existing = await model.findFirst({ where: scopeWhere(req, { id: BigInt(id) }) });
      if (!existing) throw ApiError.notFound(`${entityLabel} not found`);

      if (softDelete) {
        await model.update({ where: { id: BigInt(id) }, data: { deletedAt: new Date() } });
      } else {
        await model.delete({ where: { id: BigInt(id) } });
      }

      await recordAudit({
        req,
        moduleName,
        actionType: 'DELETE',
        entityName: modelName,
        entityId: BigInt(id),
        oldValues: existing,
      });
      return { id };
    },
  };
}

export default createCrudService;
