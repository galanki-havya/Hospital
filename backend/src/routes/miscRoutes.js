import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { authorize } from '../middleware/authorize.js';
import { MODULES } from '../config/roles.js';
import { getDashboardStats } from '../services/dashboardService.js';
import prisma from '../config/prisma.js';

export const dashboardRouter = Router();

dashboardRouter.get(
  '/',
  authorize(MODULES.DASHBOARD, 'read'),
  asyncHandler(async (req, res) => {
    ok(res, await getDashboardStats(req));
  })
);

export const notificationsRouter = Router();

notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const notifications = await prisma.notification.findMany({
      where: { tenantId: req.tenantId, userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    ok(res, notifications);
  })
);

notificationsRouter.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { id: BigInt(req.params.id), userId: req.user.id, tenantId: req.tenantId },
      data: { isRead: true },
    });
    ok(res, { message: 'Marked as read' });
  })
);

notificationsRouter.patch(
  '/mark-all-read',
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, tenantId: req.tenantId, isRead: false },
      data: { isRead: true },
    });
    ok(res, { message: 'All notifications marked as read' });
  })
);

export const auditRouter = Router();

auditRouter.get(
  '/',
  authorize(MODULES.AUDIT, 'read'),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
    const skip = (page - 1) * limit;

    const where = { tenantId: req.tenantId };
    if (req.query.module) where.moduleName = req.query.module;
    if (req.query.userId) where.userId = BigInt(req.query.userId);

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    ok(res, items, {
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  })
);
