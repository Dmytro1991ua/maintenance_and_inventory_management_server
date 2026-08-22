import { prisma } from "../../config";
import { getSkipValue, getTotalPages } from "../../utils";
import { RECURRING_TASK_SELECT } from "./recurring-tasks.constants";
import type {
  CreateRecurringTask,
  RecurringTasksQuery,
  UpdateRecurringTask,
} from "./recurring-tasks.schemas";

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
      where: { isActive: true, nextDueAt: { lte: new Date() } },
      select: RECURRING_TASK_SELECT,
    }),
  create: async (data: CreateRecurringTask & { createdBy: string }) =>
    prisma.recurringTask.create({
      data: {
        title: data.title,
        description: data.description,
        priority: data.priority,
        category: data.category,
        assignedTo: data.assignedTo,
        intervalDays: data.intervalDays,
        nextDueAt: data.firstDueAt,
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
  ): Promise<void> => {
    const next = new Date(currentNextDueAt);
    next.setDate(next.getDate() + intervalDays);
    await prisma.recurringTask.update({ where: { id }, data: { nextDueAt: next } });
  },
  delete: async (id: string): Promise<void> => {
    await prisma.recurringTask.delete({ where: { id } });
  },
};
