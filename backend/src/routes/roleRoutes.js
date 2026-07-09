import { Router } from 'express';
import Joi from 'joi';
import * as roleController from '../controllers/roleController.js';
import { restrictTo } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { SYSTEM_ROLES } from '../config/roles.js';

const adminOnly = restrictTo(SYSTEM_ROLES.HOSPITAL_ADMIN);

const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });
const userParamSchema = Joi.object({ userId: Joi.number().integer().positive().required() });
const tuParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });

const createRoleSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  description: Joi.string().trim().allow('', null),
});

const setPermissionsSchema = Joi.object({
  permissionIds: Joi.array().items(Joi.number().integer().positive()).required(),
});

const changeRoleSchema = Joi.object({
  roleId: Joi.number().integer().positive().required(),
});

const router = Router();

// All routes here are admin-only
router.use(adminOnly);

// Permissions catalog (read-only)
router.get('/permissions', roleController.listPermissions);
router.post('/permissions/seed', roleController.seedPermissions);

// Roles CRUD
router.get('/', roleController.listRoles);
router.post('/', validate({ body: createRoleSchema }), roleController.createRole);
router.put(
  '/:id/permissions',
  validate({ params: idParamSchema, body: setPermissionsSchema }),
  roleController.setRolePermissions
);

// Tenant user management
router.get('/users', roleController.listTenantUsers);
router.patch(
  '/users/:id/role',
  validate({ params: tuParamSchema, body: changeRoleSchema }),
  roleController.changeUserRole
);
router.patch(
  '/users/:userId/toggle-active',
  validate({ params: userParamSchema }),
  roleController.toggleUserActive
);

export default router;
