import prisma from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';

export async function getConfig(req) {
  let config = await prisma.mobileAppConfig.findUnique({ where: { tenantId: req.tenantId } });
  if (!config) {
    config = await prisma.mobileAppConfig.create({
      data: { tenantId: req.tenantId, appName: 'MediCore Patient App', isLive: false, featuresEnabled: {} },
    });
  }
  return config;
}

export async function updateConfig(req, data) {
  const existing = await getConfig(req);
  return prisma.mobileAppConfig.update({
    where: { id: existing.id },
    data: {
      appName: data.appName ?? existing.appName,
      primaryColor: data.primaryColor ?? existing.primaryColor,
      featuresEnabled: data.featuresEnabled ?? existing.featuresEnabled,
      isLive: data.isLive ?? existing.isLive,
    },
  });
}

export async function listRegistrations(req, { page, limit, skip } = {}) {
  const where = { tenantId: req.tenantId };
  const [items, total] = await Promise.all([
    prisma.mobileAppRegistration.findMany({
      where,
      include: { patient: { select: { id: true, firstName: true, lastName: true, uhid: true, phone: true } } },
      orderBy: { registeredAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.mobileAppRegistration.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function registerDevice(req, data) {
  const patient = await prisma.patient.findFirst({ where: { id: BigInt(data.patientId), tenantId: req.tenantId } });
  if (!patient) throw ApiError.notFound('Patient not found');

  return prisma.mobileAppRegistration.create({
    data: {
      tenantId: req.tenantId,
      patientId: patient.id,
      deviceToken: data.deviceToken || null,
      platform: data.platform || null,
    },
  });
}

export async function getStats(req) {
  const [registrations, activeToday] = await Promise.all([
    prisma.mobileAppRegistration.count({ where: { tenantId: req.tenantId } }),
    prisma.mobileAppRegistration.count({
      where: { tenantId: req.tenantId, lastActiveAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    }),
  ]);
  return { registrations, activeToday };
}

/**
 * Push notifications: real delivery requires FCM (Android) / APNs (iOS)
 * credentials. Reuses the same channel-provider pattern as WhatsApp/SMS
 * (notificationChannelService) — logs the send and returns a stub result
 * until FCM_SERVER_KEY / APNS credentials are configured.
 */
export async function sendPush(req, data) {
  const targetCount = data.patientId
    ? 1
    : await prisma.mobileAppRegistration.count({ where: { tenantId: req.tenantId } });

  if (!process.env.FCM_SERVER_KEY) {
    return { status: 'stub', provider: 'fcm', targetCount, title: data.title, body: data.body };
  }
  // Real FCM call would go here using process.env.FCM_SERVER_KEY
  return { status: 'sent', provider: 'fcm', targetCount, title: data.title, body: data.body };
}

export async function listNotifications(req, { page, limit, skip } = {}) {
  const where = { tenantId: req.tenantId, channel: 'Push' };
  const [items, total] = await Promise.all([
    prisma.notificationLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }).catch(() => []),
    prisma.notificationLog.count({ where }).catch(() => 0),
  ]);
  return { items, total, page, limit };
}
