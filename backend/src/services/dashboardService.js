import prisma from '../config/prisma.js';

export async function getDashboardStats(req) {
  const tenantId = req.tenantId;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalPatients,
    newPatientsThisMonth,
    todayAppointments,
    pendingAppointments,
    activeAdmissions,
    bedStats,
    todayRevenue,
    monthRevenue,
    pendingBills,
    labOrdersToday,
    pendingLeaves,
    lowStockCount,
    recentActivity,
    appointmentsByStatus,
    revenueByDay,
    activeEmergencies,
  ] = await Promise.all([
    prisma.patient.count({ where: { tenantId, deletedAt: null } }),
    prisma.patient.count({ where: { tenantId, deletedAt: null, createdAt: { gte: monthStart } } }),
    prisma.appointment.count({ where: { tenantId, deletedAt: null, appointmentTime: { gte: todayStart } } }),
    prisma.appointment.count({ where: { tenantId, deletedAt: null, status: 'Scheduled', appointmentTime: { gte: todayStart } } }),
    prisma.admission.count({ where: { tenantId, deletedAt: null, status: 'Admitted' } }),
    prisma.bed.groupBy({ by: ['status'], where: { tenantId }, _count: { id: true } }),
    prisma.payment.aggregate({ where: { tenantId, status: 'Success', paymentDate: { gte: todayStart } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { tenantId, status: 'Success', paymentDate: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.bill.count({ where: { tenantId, deletedAt: null, status: { in: ['Draft', 'PartiallyPaid'] } } }),
    prisma.labOrder.count({ where: { tenantId, deletedAt: null, orderDate: { gte: todayStart } } }),
    prisma.leaveApplication.count({ where: { employee: { tenantId }, status: 'Pending' } }),
    prisma.medicine.count({
      where: {
        tenantId,
        isActive: true,
        deletedAt: null,
        batches: { some: { availableQuantity: { gt: 0 } } },
      },
    }),
    prisma.auditLog.findMany({
      where: { tenantId },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    prisma.appointment.groupBy({ by: ['status'], where: { tenantId, deletedAt: null }, _count: { id: true } }),
    // last 7 days revenue
    prisma.$queryRaw`
      SELECT DATE(payment_date) as date, SUM(amount) as total
      FROM payments
      WHERE tenant_id = ${tenantId}
        AND status = 'Success'
        AND payment_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(payment_date)
      ORDER BY date ASC
    `,
    prisma.emergencyCase.count({ where: { tenantId, status: { in: ['Waiting', 'InTreatment'] } } }),
  ]);

  const beds = { total: 0, available: 0, occupied: 0 };
  for (const row of bedStats) {
    beds.total += row._count.id;
    if (row.status === 'Available') beds.available = row._count.id;
    if (row.status === 'Occupied') beds.occupied = row._count.id;
  }

  return {
    patients: { total: totalPatients, newThisMonth: newPatientsThisMonth },
    appointments: {
      today: todayAppointments,
      pending: pendingAppointments,
      byStatus: appointmentsByStatus.map((a) => ({ status: a.status, count: a._count.id })),
    },
    ipd: { activeAdmissions, beds },
    revenue: {
      today: Number(todayRevenue._sum.amount ?? 0),
      thisMonth: Number(monthRevenue._sum.amount ?? 0),
      pendingBills,
      revenueByDay,
    },
    lab: { ordersToday: labOrdersToday },
    hr: { pendingLeaves },
    pharmacy: { lowStockItems: lowStockCount },
    emergency: { activeCases: activeEmergencies },
    recentActivity: recentActivity.map((a) => ({
      id: a.id,
      action: `${a.actionType} ${a.entityName}`,
      user: a.user ? `${a.user.firstName} ${a.user.lastName || ''}`.trim() : 'System',
      module: a.moduleName,
      at: a.createdAt,
    })),
  };
}
