import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import { paginationMeta } from '../utils/response.js';
import { parseListQuery } from '../utils/query.js';
import * as roleService from '../services/roleService.js';

export const listRoles = asyncHandler(async (req, res) => {
  ok(res, await roleService.listRolesWithPermissions(req));
});

export const listPermissions = asyncHandler(async (req, res) => {
  ok(res, await roleService.listAllPermissions());
});

export const createRole = asyncHandler(async (req, res) => {
  created(res, await roleService.createRole(req, req.body));
});

export const setRolePermissions = asyncHandler(async (req, res) => {
  ok(res, await roleService.setRolePermissions(req, req.params.id, req.body.permissionIds));
});

export const listTenantUsers = asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const { items, total, page, limit } = await roleService.listTenantUsers(req, lq);
  ok(res, items, paginationMeta(page, limit, total));
});

export const changeUserRole = asyncHandler(async (req, res) => {
  ok(res, await roleService.changeUserRole(req, req.params.id, req.body.roleId));
});

export const toggleUserActive = asyncHandler(async (req, res) => {
  ok(res, await roleService.toggleUserActive(req, req.params.userId));
});

export const seedPermissions = asyncHandler(async (req, res) => {
  await roleService.seedPermissions();
  ok(res, { message: 'System permissions seeded successfully' });
});
