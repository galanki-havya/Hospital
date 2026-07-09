import bcrypt from 'bcryptjs';
import prisma from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import {
  signPlatformAccessToken,
  signPlatformRefreshToken,
  verifyPlatformRefreshToken,
  expiryToDate,
} from '../utils/token.js';
import { env } from '../config/env.js';
import { recordPlatformAudit } from './platformAuditService.js';

async function buildAuthPayload(platformUser) {
  const accessToken = signPlatformAccessToken({
    sub: platformUser.id.toString(),
    platformRole: platformUser.role,
  });
  const refreshToken = signPlatformRefreshToken({ sub: platformUser.id.toString() });

  await prisma.platformUserSession.create({
    data: {
      platformUserId: platformUser.id,
      refreshToken,
      deviceName: 'web',
      expiresAt: expiryToDate(env.JWT_REFRESH_EXPIRES_IN),
    },
  });

  return {
    accessToken,
    refreshToken,
    platformUser: {
      id: platformUser.id,
      email: platformUser.email,
      firstName: platformUser.firstName,
      lastName: platformUser.lastName,
      role: platformUser.role,
    },
  };
}

/** Login for Developer / SuperAdmin accounts only — completely separate from tenant login. */
export async function login({ email, password }) {
  const platformUser = await prisma.platformUser.findUnique({ where: { email } });
  if (!platformUser || !platformUser.isActive) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const validPassword = await bcrypt.compare(password, platformUser.passwordHash);
  if (!validPassword) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  await prisma.platformUser.update({ where: { id: platformUser.id }, data: { lastLogin: new Date() } });
  await recordPlatformAudit({ platformUserId: platformUser.id, actionType: 'LOGIN' });

  return buildAuthPayload(platformUser);
}

export async function refreshSession(refreshToken) {
  let payload;
  try {
    payload = verifyPlatformRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const session = await prisma.platformUserSession.findFirst({
    where: { platformUserId: BigInt(payload.sub), refreshToken, revokedAt: null },
  });
  if (!session || (session.expiresAt && session.expiresAt < new Date())) {
    throw ApiError.unauthorized('Refresh session not found or expired');
  }

  const platformUser = await prisma.platformUser.findUnique({ where: { id: BigInt(payload.sub) } });
  if (!platformUser || !platformUser.isActive) throw ApiError.unauthorized('Platform account no longer active');

  // rotate refresh token
  await prisma.platformUserSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });

  return buildAuthPayload(platformUser);
}

export async function logout(platformUserId, refreshToken) {
  await prisma.platformUserSession.updateMany({
    where: { platformUserId: BigInt(platformUserId), refreshToken },
    data: { revokedAt: new Date() },
  });
}

export async function changePassword(platformUserId, currentPassword, newPassword) {
  const platformUser = await prisma.platformUser.findUnique({ where: { id: BigInt(platformUserId) } });
  if (!platformUser) throw ApiError.notFound('Account not found');

  const valid = await bcrypt.compare(currentPassword, platformUser.passwordHash);
  if (!valid) throw ApiError.unauthorized('Current password is incorrect');

  const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);
  await prisma.platformUser.update({ where: { id: platformUser.id }, data: { passwordHash } });
  await recordPlatformAudit({ platformUserId: platformUser.id, actionType: 'CHANGE_PASSWORD' });
}

export async function me(platformUserId) {
  const platformUser = await prisma.platformUser.findUnique({ where: { id: BigInt(platformUserId) } });
  if (!platformUser) throw ApiError.notFound('Account not found');
  return {
    id: platformUser.id,
    email: platformUser.email,
    firstName: platformUser.firstName,
    lastName: platformUser.lastName,
    role: platformUser.role,
  };
}
