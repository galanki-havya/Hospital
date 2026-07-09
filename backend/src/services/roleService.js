import prisma from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { SYSTEM_ROLES } from '../config/roles.js';
import { recordAudit } from './auditService.js';

/**
 * Returns all roles for the tenant, each with their permission list and
 * a count of users assigned to that role.
 */
export async function listRolesWithPermissions(req) {
  const roles = await prisma.role.findMany({
    where: { tenantId: req.tenantId },
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { tenantUsers: true } },
    },
    orderBy: { name: 'asc' },
  });

  return roles.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    userCount: r._count.tenantUsers,
    permissions: r.permissions.map(rp => ({
      id: rp.permission.id,
      name: rp.permission.name,
      moduleName: rp.permission.moduleName,
    })),
  }));
}

/** All permissions defined in the system (global, not tenant-scoped). */
export async function listAllPermissions() {
  return prisma.permission.findMany({ orderBy: [{ moduleName: 'asc' }, { name: 'asc' }] });
}

/**
 * Replaces the permission set for a role (full sync, not incremental).
 * Only HospitalAdmin can modify their own tenant's roles.
 */
export async function setRolePermissions(req, roleId, permissionIds) {
  const role = await prisma.role.findFirst({
    where: { id: BigInt(roleId), tenantId: req.tenantId },
  });
  if (!role) throw ApiError.notFound('Role not found for this tenant');

  if (role.name === SYSTEM_ROLES.HOSPITAL_ADMIN) {
    throw ApiError.forbidden('Cannot modify permissions of the Admin role');
  }

  // Validate all permission IDs exist
  const perms = await prisma.permission.findMany({
    where: { id: { in: permissionIds.map(BigInt) } },
  });
  if (perms.length !== permissionIds.length) {
    throw ApiError.badRequest('One or more permission IDs are invalid');
  }

  // Full replace in a transaction
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId: BigInt(roleId) } }),
    prisma.rolePermission.createMany({
      data: permissionIds.map(pid => ({ roleId: BigInt(roleId), permissionId: BigInt(pid) })),
      skipDuplicates: true,
    }),
  ]);

  await recordAudit({
    req,
    moduleName: 'roles',
    actionType: 'UPDATE',
    entityName: 'role_permissions',
    entityId: BigInt(roleId),
    newValues: { permissionIds },
  });

  return listRolesWithPermissions(req).then(roles =>
    roles.find(r => String(r.id) === String(roleId))
  );
}

/** Create a custom role for the tenant. */
export async function createRole(req, { name, description }) {
  const existing = await prisma.role.findFirst({
    where: { tenantId: req.tenantId, name },
  });
  if (existing) throw ApiError.conflict(`Role "${name}" already exists for this tenant`);

  const role = await prisma.role.create({
    data: { tenantId: req.tenantId, name, description: description || null },
  });

  await recordAudit({ req, moduleName: 'roles', actionType: 'CREATE', entityName: 'roles', entityId: role.id, newValues: { name } });
  return role;
}

/** List all users in this tenant with their roles. */
export async function listTenantUsers(req, { page, limit, skip, search }) {
  const where = { tenantId: req.tenantId };

  if (search) {
    where.user = {
      OR: [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
      ],
    };
  }

  const [items, total] = await Promise.all([
    prisma.tenantUser.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, isActive: true, lastLogin: true } },
        role: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.tenantUser.count({ where }),
  ]);

  return { items, total, page, limit };
}

/** Change a tenant user's role. */
export async function changeUserRole(req, tenantUserId, roleId) {
  const tenantUser = await prisma.tenantUser.findFirst({
    where: { id: BigInt(tenantUserId), tenantId: req.tenantId },
    include: { role: true },
  });
  if (!tenantUser) throw ApiError.notFound('User not found in this tenant');
  if (tenantUser.userId === req.user.id) throw ApiError.forbidden('You cannot change your own role');

  const role = await prisma.role.findFirst({ where: { id: BigInt(roleId), tenantId: req.tenantId } });
  if (!role) throw ApiError.notFound('Role not found for this tenant');

  const updated = await prisma.tenantUser.update({
    where: { id: BigInt(tenantUserId) },
    data: { roleId: BigInt(roleId) },
    include: {
      user: { select: { email: true, firstName: true, lastName: true } },
      role: { select: { name: true } },
    },
  });

  await recordAudit({
    req,
    moduleName: 'roles',
    actionType: 'UPDATE',
    entityName: 'tenant_users',
    entityId: BigInt(tenantUserId),
    oldValues: { role: tenantUser.role.name },
    newValues: { role: role.name },
  });

  return updated;
}

/** Toggle a user's active status. */
export async function toggleUserActive(req, userId) {
  const tenantUser = await prisma.tenantUser.findFirst({
    where: { tenantId: req.tenantId, userId: BigInt(userId) },
    include: { user: true },
  });
  if (!tenantUser) throw ApiError.notFound('User not found in this tenant');
  if (BigInt(userId) === req.user.id) throw ApiError.forbidden('You cannot deactivate your own account');

  const newStatus = !tenantUser.user.isActive;
  const updated = await prisma.user.update({
    where: { id: BigInt(userId) },
    data: { isActive: newStatus },
    select: { id: true, email: true, firstName: true, lastName: true, isActive: true },
  });

  await recordAudit({
    req,
    moduleName: 'roles',
    actionType: 'UPDATE',
    entityName: 'users',
    entityId: BigInt(userId),
    newValues: { isActive: newStatus },
  });

  return updated;
}

/**
 * Seeds the permissions table from the RBAC config if not already present.
 * Called once on first setup — idempotent.
 */
export async function seedPermissions() {
  const PERM_DEFS = [
    // Dashboard
    { name: 'dashboard:read', moduleName: 'dashboard' },
    // Patients
    { name: 'patients:read', moduleName: 'patients' },
    { name: 'patients:manage', moduleName: 'patients' },
    // Doctors
    { name: 'doctors:read', moduleName: 'doctors' },
    { name: 'doctors:manage', moduleName: 'doctors' },
    // Appointments
    { name: 'appointments:read', moduleName: 'appointments' },
    { name: 'appointments:manage', moduleName: 'appointments' },
    // Visits
    { name: 'visits:read', moduleName: 'visits' },
    { name: 'visits:manage', moduleName: 'visits' },
    // IPD
    { name: 'ipd:read', moduleName: 'ipd' },
    { name: 'ipd:manage', moduleName: 'ipd' },
    // Pharmacy
    { name: 'pharmacy:read', moduleName: 'pharmacy' },
    { name: 'pharmacy:manage', moduleName: 'pharmacy' },
    // Lab
    { name: 'lab:read', moduleName: 'lab' },
    { name: 'lab:manage', moduleName: 'lab' },
    // Radiology
    { name: 'radiology:read', moduleName: 'radiology' },
    { name: 'radiology:manage', moduleName: 'radiology' },
    // Billing
    { name: 'billing:read', moduleName: 'billing' },
    { name: 'billing:manage', moduleName: 'billing' },
    // HR
    { name: 'hr:read', moduleName: 'hr' },
    { name: 'hr:manage', moduleName: 'hr' },
    // Departments
    { name: 'departments:read', moduleName: 'departments' },
    { name: 'departments:manage', moduleName: 'departments' },
    // Notifications
    { name: 'notifications:manage', moduleName: 'notifications' },
    // Audit
    { name: 'audit:read', moduleName: 'audit' },
    // Roles / Users admin
    { name: 'roles:read', moduleName: 'roles' },
    { name: 'roles:manage', moduleName: 'roles' },
    { name: 'users:read', moduleName: 'users' },
    { name: 'users:manage', moduleName: 'users' },
  ];

  for (const perm of PERM_DEFS) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: perm,
    });
  }
}
