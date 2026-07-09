import { ApiError } from '../utils/ApiError.js';
import { hasAccess } from '../config/roles.js';

/**
 * Coarse-grained RBAC gate. Usage: authorize(MODULES.PATIENTS, 'manage')
 * Must run after `authenticate` (relies on req.role).
 */
export function authorize(moduleName, level = 'read') {
  return (req, res, next) => {
    if (!req.role) {
      return next(ApiError.unauthorized('Authentication required'));
    }
    if (!hasAccess(req.role.name, moduleName, level)) {
      return next(ApiError.forbidden(`Your role (${req.role.name}) does not have ${level} access to ${moduleName}`));
    }
    next();
  };
}

/** Restricts a route to an explicit allow-list of role names. */
export function restrictTo(...roleNames) {
  return (req, res, next) => {
    if (!req.role) {
      return next(ApiError.unauthorized('Authentication required'));
    }
    if (!roleNames.includes(req.role.name)) {
      return next(ApiError.forbidden('You do not have permission to perform this action'));
    }
    next();
  };
}

export default authorize;
