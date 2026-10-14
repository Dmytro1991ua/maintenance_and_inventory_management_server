import { prisma } from "../../config";
import { Prisma, ScheduleTrigger } from "../../generated/prisma/client";
import { getSkipValue, getTotalPages } from "../../utils";
import { METER_SCHEDULE_SELECT, RECURRING_TASK_SELECT } from "./recurring-tasks.constants";
import type {
  CreateMeterRecurringTask,
  CreateTimeRecurringTask,
  RecurringTasksQuery,
  UpdateRecurringTask,
} from "./recurring-tasks.schemas";

type ScheduleOwner = { createdBy: string };

export const recurringTasksRepository = {
  findAll: async ({ page, limit, isActive }: RecurringTasksQuery) => {
    const skip = getSkipValue(page, limit);

    const where = isActive !== undefined ? { isActive } : {};

    const [total, items] = await Promise.all([
      prisma.recurringTask.count({ where }),
      prisma.recurringTask.findMany({
        where,
        select: RECURRING_TASK_SELECT,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return { data: items, meta: { total, page, limit, pages: getTotalPages(total, limit) } };
  },
  findById: async (id: string) =>
    prisma.recurringTask.findUnique({ where: { id }, select: RECURRING_TASK_SELECT }),
  findDue: async () =>
    prisma.recurringTask.findMany({
      where: {
        isActive: true,
        triggerType: ScheduleTrigger.TIME,
        nextDueAt: { lte: new Date() },
      },
      select: RECURRING_TASK_SELECT,
    }),
  findActiveMeterSchedules: async (meterId?: string) =>
    prisma.recurringTask.findMany({
      where: {
        isActive: true,
        triggerType: ScheduleTrigger.METER,
        ...(meterId && { meterId }),
      },
      select: METER_SCHEDULE_SELECT,
    }),
  countByMeter: async (meterId: string): Promise<number> =>
    prisma.recurringTask.count({ where: { meterId } }),
  create: async (data: CreateTimeRecurringTask & ScheduleOwner) =>
    prisma.recurringTask.create({
      data: {
        title: data.title,
        description: data.description,
        priority: data.priority,
        category: data.category,
        assignedTo: data.assignedTo,
        assetId: data.assetId,
        triggerType: ScheduleTrigger.TIME,
        intervalDays: data.intervalDays,
        nextDueAt: data.firstDueAt,
        createdBy: data.createdBy,
      },
      select: RECURRING_TASK_SELECT,
    }),
  createMeterBased: async (
    data: Omit<CreateMeterRecurringTask, "firstDueReading"> &
      ScheduleOwner & { assetId: string; firstDueReading: number },
  ) =>
    prisma.recurringTask.create({
      data: {
        title: data.title,
        description: data.description,
        priority: data.priority,
        category: data.category,
        assignedTo: data.assignedTo,
        assetId: data.assetId,
        triggerType: ScheduleTrigger.METER,
        meterId: data.meterId,
        intervalReading: data.intervalReading,
        firstDueReading: data.firstDueReading,
        nextDueReading: data.firstDueReading,
        createdBy: data.createdBy,
      },
      select: RECURRING_TASK_SELECT,
    }),
  update: async (id: string, data: UpdateRecurringTask) =>
    prisma.recurringTask.update({ where: { id }, data, select: RECURRING_TASK_SELECT }),
  setActive: async (id: string, isActive: boolean) =>
    prisma.recurringTask.update({
      where: { id },
      data: { isActive },
      select: RECURRING_TASK_SELECT,
    }),
  advanceNextDueAt: async (
    id: string,
    intervalDays: number,
    currentNextDueAt: Date,
    db: Prisma.TransactionClient = prisma,
  ): Promise<void> => {
    const next = new Date(currentNextDueAt);
    next.setDate(next.getDate() + intervalDays);
    await db.recurringTask.update({ where: { id }, data: { nextDueAt: next } });
  },
  delete: async (id: string): Promise<void> => {
    await prisma.recurringTask.delete({ where: { id } });
  },
};
