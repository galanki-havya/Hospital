/** Parses ?page=&limit=&sortBy=&sortDir=&search= into a normalized object. */
export function parseListQuery(query, { defaultLimit = 20, maxLimit = 100, defaultSortBy = 'createdAt' } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  const sortBy = query.sortBy || defaultSortBy;
  const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';
  const search = (query.search || '').trim();
  return { page, limit, skip: (page - 1) * limit, sortBy, sortDir, search };
}

/** Serializes BigInt fields to strings/numbers recursively for JSON responses. */
export function serializeBigInt(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') {
    return value > Number.MAX_SAFE_INTEGER ? value.toString() : Number(value);
  }
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(serializeBigInt);
  if (typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) {
      out[key] = serializeBigInt(value[key]);
    }
    return out;
  }
  return value;
}
