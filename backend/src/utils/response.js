/**
 * Consistent success envelope for all API responses:
 * { success: true, data, meta? }
 */
export function ok(res, data, meta = undefined, statusCode = 200) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

export function created(res, data) {
  return ok(res, data, undefined, 201);
}

export function noContent(res) {
  return res.status(204).send();
}

/** Builds a `meta.pagination` block from page/limit/total. */
export function paginationMeta(page, limit, total) {
  return {
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}
