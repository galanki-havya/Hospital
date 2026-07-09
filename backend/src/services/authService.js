import bcrypt from 'bcryptjs';
import prisma from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken, expiryToDate } from '../utils/token.js';
import { env } from '../config/env.js';
import { SYSTEM_ROLES } from '../config/roles.js';
import { recordAudit } from './auditService.js';

// SuperAdmin/Developer are PLATFORM_ROLES now, not tenant roles — every
// hospital only gets the tenant-scoped roles below seeded into its own
// roles table.
const SAAS_DEFAULT_ROLES = Object.values(SYSTEM_ROLES);

function genTenantCode(name) {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6) || 'HOSP';
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${base}${suffix}`;
}

async function buildAuthPayload(user, tenant, role) {
  const accessToken = signAccessToken({
    sub: user.id.toString(),
    tenantId: tenant.id.toString(),
    roleId: role.id.toString(),
    roleName: role.name,
  });
  const refreshToken = signRefreshToken({ sub: user.id.toString(), tenantId: tenant.id.toString() });

  await prisma.userSession.create({
    data: {
      userId: user.id,
      refreshToken,
      deviceName: 'web',
      expiresAt: expiryToDate(env.JWT_REFRESH_EXPIRES_IN),
    },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePhoto: user.profilePhoto,
    },
    tenant: {
      id: tenant.id,
      name: tenant.name,
      code: tenant.code,
      type: tenant.type,
      logoUrl: tenant.logoUrl,
    },
    role: { id: role.id, name: role.name },
  };
}

/**
 * Core hospital-workspace provisioning: creates the Tenant, seeds its
 * tenant-scoped role set, and creates its first HospitalAdmin user.
 * Shared by the (optional, off-by-default) self-serve signup flow below
 * and by platformService.createHospital(), which is how SuperAdmins
 * provision hospitals in the recommended flow.
 *
 * @param {object} payload - hospitalName, hospitalType, hospitalEmail, hospitalPhone, adminFirstName, adminLastName, adminEmail, password
 * @param {object} opts - { createdByPlatformUserId }
 */
export async function createTenantWithAdmin(payload, opts = {}) {
  const existingUser = await prisma.user.findUnique({ where: { email: payload.adminEmail } });
  if (existingUser) {
    throw ApiError.conflict('An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(payload.password, env.BCRYPT_SALT_ROUNDS);

  return prisma.$transaction(async (tx) => {
    let code = genTenantCode(payload.hospitalName);
    // ensure uniqueness (very low collision odds, but be safe)
    while (await tx.tenant.findUnique({ where: { code } })) {
      code = genTenantCode(payload.hospitalName);
    }

    const tenant = await tx.tenant.create({
      data: {
        name: payload.hospitalName,
        code,
        type: payload.hospitalType,
        email: payload.hospitalEmail,
        phone: payload.hospitalPhone || null,
        status: 'Active',
        createdByPlatformUserId: opts.createdByPlatformUserId ?? null,
      },
    });

    const roles = await Promise.all(
      SAAS_DEFAULT_ROLES.map((name) =>
        tx.role.create({ data: { tenantId: tenant.id, name, description: `${name} role` } })
      )
    );
    const adminRole = roles.find((r) => r.name === SYSTEM_ROLES.HOSPITAL_ADMIN);

    const user = await tx.user.create({
      data: {
        email: payload.adminEmail,
        passwordHash,
        firstName: payload.adminFirstName,
        lastName: payload.adminLastName || null,
        emailVerified: true,
        isActive: true,
      },
    });

    await tx.tenantUser.create({
      data: { tenantId: tenant.id, userId: user.id, roleId: adminRole.id },
    });

    return { tenant, user, role: adminRole };
  });
}

/**
 * Registers a brand-new hospital workspace (tenant) + its first admin user
 * via public self-serve signup. Disabled by default — see authController.register.
 */
export async function registerTenant(payload) {
  const result = await createTenantWithAdmin(payload);
  return buildAuthPayload(result.user, result.tenant, result.role);
}

/**
 * Logs a user into a specific tenant workspace. If the user belongs to more
 * than one tenant and no tenantCode is supplied, returns the list of
 * workspaces so the frontend can prompt for a selection.
 */
export async function login({ email, password, tenantCode }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.deletedAt || !user.isActive) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const memberships = await prisma.tenantUser.findMany({
    where: { userId: user.id },
    include: { tenant: true, role: true },
  });

  const activeMemberships = memberships.filter((m) => m.tenant.status === 'Active' && !m.tenant.deletedAt);
  if (activeMemberships.length === 0) {
    throw ApiError.forbidden('No active hospital workspace found for this account');
  }

  let membership = activeMemberships[0];
  if (tenantCode) {
    membership = activeMemberships.find((m) => m.tenant.code === tenantCode);
    if (!membership) throw ApiError.forbidden('You do not have access to that workspace');
  } else if (activeMemberships.length > 1) {
    return {
      requiresTenantSelection: true,
      workspaces: activeMemberships.map((m) => ({
        tenantCode: m.tenant.code,
        tenantName: m.tenant.name,
        roleName: m.role.name,
      })),
    };
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

  return buildAuthPayload(user, membership.tenant, membership.role);
}

export async function refreshSession(refreshToken) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const session = await prisma.userSession.findFirst({
    where: { userId: BigInt(payload.sub), refreshToken },
  });
  if (!session || (session.expiresAt && session.expiresAt < new Date())) {
    throw ApiError.unauthorized('Refresh session not found or expired');
  }

  const membership = await prisma.tenantUser.findFirst({
    where: { userId: BigInt(payload.sub), tenantId: BigInt(payload.tenantId) },
    include: { tenant: true, role: true, user: true },
  });
  if (!membership) throw ApiError.unauthorized('Workspace membership no longer exists');

  // rotate refresh token
  await prisma.userSession.delete({ where: { id: session.id } });

  return buildAuthPayload(membership.user, membership.tenant, membership.role);
}

export async function logout(userId, refreshToken) {
  await prisma.userSession.deleteMany({ where: { userId: BigInt(userId), refreshToken } });
}

/** Hospital admin invites a new staff member into their tenant. */
export async function inviteStaff(req, payload) {
  const role = await prisma.role.findFirst({ where: { tenantId: req.tenantId, name: payload.roleName } });
  if (!role) throw ApiError.badRequest(`Role "${payload.roleName}" is not configured for this tenant`);

  let user = await prisma.user.findUnique({ where: { email: payload.email } });

  if (user) {
    const alreadyMember = await prisma.tenantUser.findFirst({ where: { tenantId: req.tenantId, userId: user.id } });
    if (alreadyMember) throw ApiError.conflict('This user is already a member of your workspace');
  } else {
    const passwordHash = await bcrypt.hash(payload.password, env.BCRYPT_SALT_ROUNDS);
    user = await prisma.user.create({
      data: {
        email: payload.email,
        passwordHash,
        firstName: payload.firstName,
        lastName: payload.lastName || null,
        phone: payload.phone || null,
        isActive: true,
        emailVerified: true,
      },
    });
  }

  const tenantUser = await prisma.tenantUser.create({
    data: { tenantId: req.tenantId, userId: user.id, roleId: role.id },
  });

  await recordAudit({
    req,
    moduleName: 'users',
    actionType: 'CREATE',
    entityName: 'tenant_users',
    entityId: tenantUser.id,
    newValues: { email: payload.email, roleName: payload.roleName },
  });

  return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: role.name };
}

export async function changePassword(userId, currentPassword, newPassword) {
  const user = await prisma.user.findUnique({ where: { id: BigInt(userId) } });
  if (!user) throw ApiError.notFound('User not found');

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw ApiError.badRequest('Current password is incorrect');

  const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  await prisma.userSession.deleteMany({ where: { userId: user.id } });
}

export async function updateProfile(userId, data) {
  return prisma.user.update({ where: { id: BigInt(userId) }, data });
}
