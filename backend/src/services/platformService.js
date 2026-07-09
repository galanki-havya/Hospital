import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { parseListQuery } from '../utils/query.js';
import { createTenantWithAdmin } from './authService.js';
import { recordPlatformAudit } from './platformAuditService.js';
import { PLATFORM_ROLES } from '../config/roles.js';

/**
 * IMPORTANT PRIVACY BOUNDARY:
 * Every function below queries only `Tenant`, `PlatformUser`, and
 * `TenantUser` (for headcounts / the HospitalAdmin's own contact info).
 * None of them ever import a clinical service (patientService, visitService,
 * pharmacyService, etc.) or query Patient/Visit/Prescription/MedicalRecord/
 * Billing/etc. That is intentional and should stay that way: SuperAdmin's
 * job is "how many hospitals, are they active, what plan" — not hospital
 * operations.
 */

const HOSPITAL_SUMMARY_SELECT = {
  id: true,
  name: true,
  code: true,
  type: true,
  email: true,
  phone: true,
  status: true,
  plan: true,
  planExpiresAt: true,
  suspendedReason: true,
  createdAt: true,
  _count: { select: { tenantUsers: true } },
};

function randomTempPassword() {
  return crypto.randomBytes(9).toString('base64url'); // 12-char, URL-safe
}

/** List all hospitals (tenants) with basic status + staff headcount only. */
export async function listHospitals(reqQuery) {
  const { page, limit, skip, sortBy, sortDir, search } = parseListQuery(reqQuery, { defaultSortBy: 'createdAt' });

  const where = search
    ? { OR: [{ name: { contains: search } }, { code: { contains: search } }, { email: { contains: search } }] }
    : {};

  const [items, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      select: HOSPITAL_SUMMARY_SELECT,
      orderBy: { [sortBy]: sortDir },
      skip,
      take: limit,
    }),
    prisma.tenant.count({ where }),
  ]);

  return {
    items: items.map((t) => ({
      id: t.id,
      name: t.name,
      code: t.code,
      type: t.type,
      email: t.email,
      phone: t.phone,
      status: t.status,
      plan: t.plan,
      planExpiresAt: t.planExpiresAt,
      suspendedReason: t.suspendedReason,
      createdAt: t.createdAt,
      staffCount: t._count.tenantUsers,
    })),
    total,
    page,
    limit,
  };
}

/** A single hospital's metadata + its HospitalAdmin's contact info + staff breakdown by role. Still no clinical data. */
export async function getHospital(tenantId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: BigInt(tenantId) },
    select: HOSPITAL_SUMMARY_SELECT,
  });
  if (!tenant) throw ApiError.notFound('Hospital not found');

  const [roleBreakdown, adminMembership] = await Promise.all([
    prisma.role.findMany({
      where: { tenantId: BigInt(tenantId) },
      select: { name: true, _count: { select: { tenantUsers: true } } },
    }),
    prisma.tenantUser.findFirst({
      where: { tenantId: BigInt(tenantId), role: { name: 'HospitalAdmin' } },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  return {
    id: tenant.id,
    name: tenant.name,
    code: tenant.code,
    type: tenant.type,
    email: tenant.email,
    phone: tenant.phone,
    status: tenant.status,
    plan: tenant.plan,
    planExpiresAt: tenant.planExpiresAt,
    suspendedReason: tenant.suspendedReason,
    createdAt: tenant.createdAt,
    staffCount: tenant._count.tenantUsers,
    staffByRole: roleBreakdown.map((r) => ({ role: r.name, count: r._count.tenantUsers })),
    hospitalAdmin: adminMembership
      ? {
          id: adminMembership.user.id,
          email: adminMembership.user.email,
          firstName: adminMembership.user.firstName,
          lastName: adminMembership.user.lastName,
          phone: adminMembership.user.phone,
        }
      : null,
  };
}

/** Platform-wide counters for the SuperAdmin/Developer dashboard. */
export async function getStats() {
  const [totalHospitals, activeHospitals, inactiveHospitals, last30Days] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { status: 'Active' } }),
    prisma.tenant.count({ where: { status: 'Inactive' } }),
    prisma.tenant.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } } }),
  ]);

  return { totalHospitals, activeHospitals, inactiveHospitals, newHospitalsLast30Days: last30Days };
}

/**
 * Creates a new hospital workspace + its first HospitalAdmin.
 * Callable by SuperAdmin or Developer. Returns the generated temp password
 * once so the platform operator can hand it to the hospital — it is never
 * retrievable again (only a reset is possible afterwards).
 */
export async function createHospital(req, payload) {
  const tempPassword = payload.password || randomTempPassword();

  const result = await createTenantWithAdmin(
    { ...payload, password: tempPassword },
    { createdByPlatformUserId: req.platformUser.id }
  );

  await recordPlatformAudit({
    platformUserId: req.platformUser.id,
    actionType: 'CREATE_HOSPITAL',
    targetTenantId: result.tenant.id,
    metadata: { hospitalName: result.tenant.name, hospitalCode: result.tenant.code, adminEmail: result.user.email },
    ipAddress: req.ip,
  });

  return {
    hospital: { id: result.tenant.id, name: result.tenant.name, code: result.tenant.code },
    hospitalAdmin: { email: result.user.email, temporaryPassword: tempPassword },
  };
}

/** Activate/suspend a hospital. Suspending immediately blocks all of its staff logins (enforced in tenant `authenticate`). */
export async function setHospitalStatus(req, tenantId, status, reason) {
  const tenant = await prisma.tenant.findUnique({ where: { id: BigInt(tenantId) } });
  if (!tenant) throw ApiError.notFound('Hospital not found');

  const updated = await prisma.tenant.update({
    where: { id: BigInt(tenantId) },
    data: { status, suspendedReason: status === 'Inactive' ? reason || null : null },
  });

  await recordPlatformAudit({
    platformUserId: req.platformUser.id,
    actionType: status === 'Active' ? 'ACTIVATE_HOSPITAL' : 'SUSPEND_HOSPITAL',
    targetTenantId: updated.id,
    metadata: { reason: reason || null },
    ipAddress: req.ip,
  });

  return { id: updated.id, status: updated.status };
}

/** Set/update a hospital's subscription plan. */
export async function setHospitalPlan(req, tenantId, plan, planExpiresAt) {
  const tenant = await prisma.tenant.findUnique({ where: { id: BigInt(tenantId) } });
  if (!tenant) throw ApiError.notFound('Hospital not found');

  const updated = await prisma.tenant.update({
    where: { id: BigInt(tenantId) },
    data: { plan, planExpiresAt: planExpiresAt ? new Date(planExpiresAt) : null },
  });

  await recordPlatformAudit({
    platformUserId: req.platformUser.id,
    actionType: 'UPDATE_HOSPITAL_PLAN',
    targetTenantId: updated.id,
    metadata: { plan, planExpiresAt },
    ipAddress: req.ip,
  });

  return { id: updated.id, plan: updated.plan, planExpiresAt: updated.planExpiresAt };
}

/**
 * Resets a hospital's HospitalAdmin password. Returns the new temp password
 * once. Does NOT touch any other user, and never reads clinical data.
 */
export async function resetHospitalAdminPassword(req, tenantId) {
  const membership = await prisma.tenantUser.findFirst({
    where: { tenantId: BigInt(tenantId), role: { name: 'HospitalAdmin' } },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!membership) throw ApiError.notFound('No HospitalAdmin found for this hospital');

  const tempPassword = randomTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  await prisma.user.update({ where: { id: membership.user.id }, data: { passwordHash } });

  await recordPlatformAudit({
    platformUserId: req.platformUser.id,
    actionType: 'RESET_HOSPITAL_ADMIN_PASSWORD',
    targetTenantId: BigInt(tenantId),
    metadata: { adminEmail: membership.user.email },
    ipAddress: req.ip,
  });

  return { email: membership.user.email, temporaryPassword: tempPassword };
}

// ── Developer-only: manage SuperAdmin accounts ─────────────────────────────

export async function createSuperAdmin(req, payload) {
  const existing = await prisma.platformUser.findUnique({ where: { email: payload.email } });
  if (existing) throw ApiError.conflict('A platform account with this email already exists');

  const tempPassword = payload.password || randomTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const created = await prisma.platformUser.create({
    data: {
      email: payload.email,
      passwordHash,
      firstName: payload.firstName,
      lastName: payload.lastName || null,
      role: PLATFORM_ROLES.SUPER_ADMIN,
      createdByPlatformUserId: req.platformUser.id,
    },
  });

  await recordPlatformAudit({
    platformUserId: req.platformUser.id,
    actionType: 'CREATE_SUPER_ADMIN',
    metadata: { email: created.email },
    ipAddress: req.ip,
  });

  return { id: created.id, email: created.email, temporaryPassword: tempPassword };
}

export async function listSuperAdmins() {
  const admins = await prisma.platformUser.findMany({
    where: { role: PLATFORM_ROLES.SUPER_ADMIN },
    select: { id: true, email: true, firstName: true, lastName: true, isActive: true, lastLogin: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return admins;
}

export async function setSuperAdminStatus(req, platformUserId, isActive) {
  const target = await prisma.platformUser.findUnique({ where: { id: BigInt(platformUserId) } });
  if (!target || target.role !== PLATFORM_ROLES.SUPER_ADMIN) throw ApiError.notFound('SuperAdmin account not found');

  const updated = await prisma.platformUser.update({ where: { id: target.id }, data: { isActive } });

  await recordPlatformAudit({
    platformUserId: req.platformUser.id,
    actionType: isActive ? 'ACTIVATE_SUPER_ADMIN' : 'DEACTIVATE_SUPER_ADMIN',
    metadata: { targetEmail: updated.email },
    ipAddress: req.ip,
  });

  return { id: updated.id, isActive: updated.isActive };
}

export async function listPlatformAuditLogs(reqQuery) {
  const { page, limit, skip } = parseListQuery(reqQuery, { defaultSortBy: 'createdAt' });
  const [items, total] = await Promise.all([
    prisma.platformAuditLog.findMany({
      include: { platformUser: { select: { email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.platformAuditLog.count(),
  ]);
  return { items, total, page, limit };
}
