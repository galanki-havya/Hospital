import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as platformAuthService from '../services/platformAuthService.js';

export const login = asyncHandler(async (req, res) => {
  const result = await platformAuthService.login(req.body);
  ok(res, result);
});

export const refresh = asyncHandler(async (req, res) => {
  const result = await platformAuthService.refreshSession(req.body.refreshToken);
  ok(res, result);
});

export const logout = asyncHandler(async (req, res) => {
  await platformAuthService.logout(req.platformUser.id, req.body.refreshToken);
  ok(res, { loggedOut: true });
});

export const me = asyncHandler(async (req, res) => {
  const result = await platformAuthService.me(req.platformUser.id);
  ok(res, result);
});

export const changePassword = asyncHandler(async (req, res) => {
  await platformAuthService.changePassword(req.platformUser.id, req.body.currentPassword, req.body.newPassword);
  ok(res, { changed: true });
});
