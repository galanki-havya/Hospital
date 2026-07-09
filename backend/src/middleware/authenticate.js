import { verifyAccessToken } from '../utils/token.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import prisma from '../config/prisma.js';

/**
 * Verifies the Bearer access token, then re-fetches the live tenant_users
 * row (joined to role) so a role/permission change or deactivation takes
 * effect on the very next request rather than waiting for token expiry.
 *
 * Populates:
 *   req.user      -> { id, email, firstName, lastName }
 *   req.tenantId  -> BigInt of the active tenant
 *   req.role      -> { id, name }
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Missing or malformed Authorization header');
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    throw ApiError.unauthorized(err.name === 'TokenExpiredError' ? 'Access token expired' : 'Invalid access token');
  }

  // Platform (Developer/SuperAdmin) tokens carry no tenantId and are never
  // valid here — they authenticate exclusively via authenticatePlatform.
  if (payload.scope === 'platform' || !payload.tenantId) {
    throw ApiError.unauthorized('Invalid access token for this workspace');
  }

  const tenantUser = await prisma.tenantUser.findFirst({
    where: { userId: BigInt(payload.sub), tenantId: BigInt(payload.tenantId) },
    include: {
      user: true,
      role: true,
      tenant: true,
    },
  });

  if (!tenantUser || !tenantUser.user.isActive || tenantUser.user.deletedAt) {
    throw ApiError.unauthorized('Account is no longer active for this tenant');
  }

  if (tenantUser.tenant.status !== 'Active' || tenantUser.tenant.deletedAt) {
    throw ApiError.forbidden('This hospital workspace is currently inactive');
  }

  req.user = {
    id: tenantUser.user.id,
    email: tenantUser.user.email,
    firstName: tenantUser.user.firstName,
    lastName: tenantUser.user.lastName,
  };
  req.tenantId = tenantUser.tenant.id;
  req.tenant = tenantUser.tenant;
  req.role = { id: tenantUser.role.id, name: tenantUser.role.name };

  next();
});

export default authenticate;
