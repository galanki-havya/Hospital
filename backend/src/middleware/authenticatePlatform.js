import { verifyPlatformAccessToken } from '../utils/token.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import prisma from '../config/prisma.js';

/**
 * Verifies a platform (Developer/SuperAdmin) Bearer token and re-fetches
 * the live PlatformUser row so a deactivation takes effect immediately.
 *
 * Populates:
 *   req.platformUser -> { id, email, firstName, lastName }
 *   req.platformRole -> 'Developer' | 'SuperAdmin'
 *
 * Deliberately does NOT set req.tenantId / req.tenant / req.user — platform
 * requests are never tenant-scoped, and every platform service only ever
 * queries the Tenant table + aggregate counts, never Patient/Visit/etc.
 */
export const authenticatePlatform = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Missing or malformed Authorization header');
  }

  let payload;
  try {
    payload = verifyPlatformAccessToken(token);
  } catch (err) {
    throw ApiError.unauthorized(
      err.name === 'TokenExpiredError' ? 'Access token expired' : 'Invalid or non-platform access token'
    );
  }

  const platformUser = await prisma.platformUser.findUnique({ where: { id: BigInt(payload.sub) } });

  if (!platformUser || !platformUser.isActive) {
    throw ApiError.unauthorized('Platform account is no longer active');
  }

  req.platformUser = {
    id: platformUser.id,
    email: platformUser.email,
    firstName: platformUser.firstName,
    lastName: platformUser.lastName,
  };
  req.platformRole = platformUser.role;

  next();
});

export default authenticatePlatform;
