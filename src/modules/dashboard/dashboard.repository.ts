import { prisma } from "../../config";
import { Role, TaskStatus } from "../../generated/prisma/client";

const startOfCurrentMonth = (): Date => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
};

const statusZero = () => ({
  OPEN: 0,
  IN_PROGRESS: 0,
  DONE: 0,
  CANCELLED: 0,
});

export const dashboardRepository = {
  getManagerStats: async () => {
    const now = new Date();
    const monthStart = startOfCurrentMonth();
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const [
      statusGroups,
      overdueCount,
      createdThisMonth,
      completedThisMonth,
      avgResult,
      inventoryResult,
      openByAssignee,
      overdueByAssignee,
      technicians,
      activeSchedules,
      schedulesThisWeek,
    ] = await Promise.all([
      prisma.task.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.task.count({
        where: {
          dueDate: { lt: now },
          status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
        },
      }),
      prisma.task.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.task.count({
        where: { status: TaskStatus.DONE, updatedAt: { gte: monthStart } },
      }),
      prisma.$queryRaw<[{ avg_days: number | null }]>`
        SELECT AVG(
          EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")) / 86400.0
        )::float AS avg_days
        FROM tasks
        WHERE status = 'DONE'
      `,
      prisma.$queryRaw<
        [
          {
            total: number;
            in_stock: number;
            low_stock: number;
            out_of_stock: number;
          },
        ]
      >`
        SELECT
          COUNT(*)::int                                                           AS total,
          COUNT(*) FILTER (WHERE quantity >= "minStockLevel")::int               AS in_stock,
          COUNT(*) FILTER (WHERE quantity > 0 AND quantity < "minStockLevel")::int AS low_stock,
          COUNT(*) FILTER (WHERE quantity = 0)::int                              AS out_of_stock
        FROM inventory_items
      `,
      prisma.task.groupBy({
        by: ["assignedTo"],
        where: {
          status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] },
          assignedTo: { not: null },
        },
        _count: { id: true },
      }),
      prisma.task.groupBy({
        by: ["assignedTo"],
        where: {
          dueDate: { lt: now },
          status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
          assignedTo: { not: null },
        },
        _count: { id: true },
      }),
      prisma.user.findMany({
        where: { roles: { has: Role.TECHNICIAN } },
        select: { id: true, userName: true },
        orderBy: { userName: "asc" },
      }),
      prisma.recurringTask.count({ where: { isActive: true } }),
      prisma.recurringTask.count({
        where: { isActive: true, nextDueAt: { lte: weekEnd } },
      }),
    ]);

    const byStatus = statusGroups.reduce(
      (acc, row) => ({ ...acc, [row.status]: row._count.id }),
      statusZero(),
    );

    const openMap = new Map(openByAssignee.map((r) => [r.assignedTo!, r._count.id]));
    const overdueMap = new Map(overdueByAssignee.map((r) => [r.assignedTo!, r._count.id]));

    return {
      tasks: {
        total: Object.values(byStatus).reduce((s, n) => s + n, 0),
        byStatus,
        overdue: overdueCount,
        createdThisMonth,
        completedThisMonth,
        avgCompletionDays:
          avgResult[0].avg_days != null ? Math.round(avgResult[0].avg_days * 10) / 10 : null,
      },
      inventory: {
        total: inventoryResult[0].total,
        inStock: inventoryResult[0].in_stock,
        lowStock: inventoryResult[0].low_stock,
        outOfStock: inventoryResult[0].out_of_stock,
      },
      technicians: technicians.map((t) => ({
        id: t.id,
        userName: t.userName,
        openTasks: openMap.get(t.id) ?? 0,
        overdueTasks: overdueMap.get(t.id) ?? 0,
      })),
      schedules: {
        active: activeSchedules,
        dueThisWeek: schedulesThisWeek,
      },
    };
  },

  getTechnicianStats: async (userId: string) => {
    const now = new Date();
    const monthStart = startOfCurrentMonth();

    const [statusGroups, overdueCount, completedThisMonth] = await Promise.all([
      prisma.task.groupBy({
        by: ["status"],
        where: { assignedTo: userId },
        _count: { id: true },
      }),
      prisma.task.count({
        where: {
          assignedTo: userId,
          dueDate: { lt: now },
          status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
        },
      }),
      prisma.task.count({
        where: {
          assignedTo: userId,
          status: TaskStatus.DONE,
          updatedAt: { gte: monthStart },
        },
      }),
    ]);

    const byStatus = statusGroups.reduce(
      (acc, row) => ({ ...acc, [row.status]: row._count.id }),
      statusZero(),
    );

    return {
      myTasks: {
        total: Object.values(byStatus).reduce((s, n) => s + n, 0),
        byStatus,
        overdue: overdueCount,
        completedThisMonth,
      },
    };
  },
};
