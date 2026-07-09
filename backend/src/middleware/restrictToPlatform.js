import { ApiError } from '../utils/ApiError.js';

/**
 * Restricts a platform route to an explicit allow-list of PLATFORM_ROLES.
 * Must run after `authenticatePlatform` (relies on req.platformRole).
 * Usage: restrictToPlatform(PLATFORM_ROLES.DEVELOPER)
 *        restrictToPlatform(PLATFORM_ROLES.DEVELOPER, PLATFORM_ROLES.SUPER_ADMIN)
 */
export function restrictToPlatform(...roleNames) {
  return (req, res, next) => {
    if (!req.platformRole) {
      return next(ApiError.unauthorized('Platform authentication required'));
    }
    if (!roleNames.includes(req.platformRole)) {
      return next(ApiError.forbidden('You do not have permission to perform this action'));
    }
    next();
  };
}

export default restrictToPlatform;
