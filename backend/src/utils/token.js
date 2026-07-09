import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * Access token payload: { sub: userId, tenantId, roleId, roleName }
 * Kept intentionally small — full user/role rows are fetched per-request
 * by the authenticate middleware so role/permission changes take effect
 * immediately without forcing a logout.
 */
export function signAccessToken(payload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES_IN });
}

export function signRefreshToken(payload) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}

/**
 * Platform tokens: { sub: platformUserId, scope: 'platform', platformRole }
 * Deliberately NEVER include tenantId, and are verified only by
 * authenticatePlatform (never by the tenant `authenticate` middleware, which
 * requires a tenantId claim and looks the user up in tenant_users). This is
 * the mechanism that keeps Developer/SuperAdmin sessions from ever being
 * usable against tenant-scoped routes, and vice versa.
 */
export function signPlatformAccessToken(payload) {
  return jwt.sign({ ...payload, scope: 'platform' }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });
}

export function signPlatformRefreshToken(payload) {
  return jwt.sign({ ...payload, scope: 'platform' }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });
}

export function verifyPlatformAccessToken(token) {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (payload.scope !== 'platform') {
    throw new Error('Not a platform token');
  }
  return payload;
}

export function verifyPlatformRefreshToken(token) {
  const payload = jwt.verify(token, env.JWT_REFRESH_SECRET);
  if (payload.scope !== 'platform') {
    throw new Error('Not a platform token');
  }
  return payload;
}

/** Converts a duration string like "7d" into a future Date for DB storage. */
export function expiryToDate(durationStr) {
  const match = /^(\d+)([smhd])$/.exec(durationStr);
  if (!match) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const [, amount, unit] = match;
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return new Date(Date.now() + Number(amount) * multipliers[unit]);
}
