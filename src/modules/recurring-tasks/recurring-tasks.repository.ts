import { prisma } from "../../config";
import { Prisma, ScheduleTrigger } from "../../generated/prisma/client";
import { getSkipValue, getTotalPages } from "../../utils";
import {
  METER_DUE_SOON_PERCENT,
  METER_SCHEDULE_SELECT,
  RECURRING_TASK_SELECT,
} from "./recurring-tasks.constants";
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
  // Active meter schedules inside the due-soon window but not yet at the threshold,
  // not yet reminded for this threshold. bigint: readings times 100 overflow a 32-bit int.
  findMeterSchedulesDueSoon: async () =>
    prisma.$queryRaw<
      {
        id: string;
        title: string;
        nextDueReading: number;
        meterName: string;
        unit: string;
        currentReading: number;
      }[]
    >`
      SELECT rt.id, rt.title, rt."nextDueReading", m.name AS "meterName", m.unit, m."currentReading"
      FROM recurring_tasks rt
      JOIN meters m ON m.id = rt."meterId"
      WHERE rt."isActive"
        AND rt."triggerType" = 'METER'
        AND rt."nextDueReading" > m."currentReading"
        AND (rt."nextDueReading" - m."currentReading")::bigint * 100
            <= rt."intervalReading"::bigint * ${METER_DUE_SOON_PERCENT}
        AND rt."reminderSentForReading" IS DISTINCT FROM rt."nextDueReading"
      ORDER BY rt.title
    `,
  // Guarded on the threshold, so a firing in between doesn't mark the new one.
  markMeterReminded: async (id: string, threshold: number): Promise<void> => {
    await prisma.recurringTask.updateMany({
      where: { id, nextDueReading: threshold },
      data: { reminderSentForReading: threshold },
    });
  },
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
