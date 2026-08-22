import { z } from "zod";

const TasksByStatusSchema = z.object({
  OPEN: z.number().int(),
  IN_PROGRESS: z.number().int(),
  DONE: z.number().int(),
  CANCELLED: z.number().int(),
});

// — Manager / Admin response —————————————————————————————————————————————————

export const ManagerDashboardSchema = z
  .object({
    tasks: z.object({
      total: z.number().int(),
      byStatus: TasksByStatusSchema,
      overdue: z.number().int(),
      createdThisMonth: z.number().int(),
      completedThisMonth: z.number().int(),
      avgCompletionDays: z.number().nullable().openapi({ example: 3.2 }),
    }),
    inventory: z.object({
      total: z.number().int(),
      inStock: z.number().int(),
      lowStock: z.number().int(),
      outOfStock: z.number().int(),
    }),
    technicians: z.array(
      z.object({
        id: z.uuid(),
        userName: z.string(),
        openTasks: z.number().int(),
        overdueTasks: z.number().int(),
      }),
    ),
    schedules: z.object({
      active: z.number().int(),
      dueThisWeek: z.number().int(),
    }),
  })
  .openapi("ManagerDashboard");

// — Technician response ——————————————————————————————————————————————————————

export const TechnicianDashboardSchema = z
  .object({
    myTasks: z.object({
      total: z.number().int(),
      byStatus: TasksByStatusSchema,
      overdue: z.number().int(),
      completedThisMonth: z.number().int(),
    }),
  })
  .openapi("TechnicianDashboard");

export const DashboardStatsResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.union([ManagerDashboardSchema, TechnicianDashboardSchema]),
  })
  .openapi("DashboardStatsResponse");
