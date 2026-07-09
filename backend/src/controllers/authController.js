import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import * as authService from '../services/authService.js';
import { recordAudit } from '../services/auditService.js';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

export const register = asyncHandler(async (req, res) => {
  // Hospitals are provisioned by a SuperAdmin via POST /api/v1/platform/hospitals
  // by default. Set ALLOW_SELF_SERVE_TENANT_SIGNUP=true if you want to also
  // allow hospitals to sign themselves up directly.
  if (!env.ALLOW_SELF_SERVE_TENANT_SIGNUP) {
    throw ApiError.forbidden(
      'Self-serve hospital signup is disabled. Ask your platform SuperAdmin to create your hospital workspace.'
    );
  }
  const result = await authService.registerTenant(req.body);
  created(res, result);
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  if (result.requiresTenantSelection) {
    return ok(res, result);
  }
  ok(res, result);
});

export const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refreshSession(req.body.refreshToken);
  ok(res, result);
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user.id, req.body.refreshToken);
  await recordAudit({ req, moduleName: 'auth', actionType: 'LOGOUT', entityName: 'users', entityId: req.user.id });
  ok(res, { message: 'Logged out successfully' });
});

export const me = asyncHandler(async (req, res) => {
  ok(res, { user: req.user, tenant: req.tenant, role: req.role });
});

export const inviteStaff = asyncHandler(async (req, res) => {
  const result = await authService.inviteStaff(req, req.body);
  created(res, result);
});

export const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
  ok(res, { message: 'Password updated successfully. Please log in again.' });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const updated = await authService.updateProfile(req.user.id, req.body);
  ok(res, updated);
});
