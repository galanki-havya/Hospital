/**
 * Prisma returns BigInt for all our `BigInt` PK/FK columns. Native JSON.stringify
 * throws on BigInt, so we patch res.json for every request to recursively
 * convert BigInt -> Number (safe for IDs in this app's scale) before sending.
 */
import { serializeBigInt } from '../utils/query.js';

export function bigIntSerializer(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = (body) => originalJson(serializeBigInt(body));
  next();
}

export default bigIntSerializer;
