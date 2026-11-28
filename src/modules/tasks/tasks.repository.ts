import { prisma } from "../../config";
import { Prisma, TaskStatus } from "../../generated/prisma/client";
import { addDays, getSkipValue, getTotalPages, resolveSortField } from "../../utils";
import { changeLogRepository } from "../change-log/change-log.repository";
import {
  ACTIVE_TASK_STATUSES,
  TASK_ENTITY_ALLOWED_SORT_FIELDS,
  TASK_ENTITY_DEFAULT_SORT_FIELD,
  TASK_SELECT,
} from "./tasks.constants";
import type { CompleteTask, CreateTask, TasksQuery, UpdateTask } from "./tasks.schemas";

type CreateTaskInput = CreateTask & { recurringTaskId?: string };
import { buildTasksWhere } from "./tasks.utils";

const createAndRecord = async (tx: Prisma.TransactionClient, data: CreateTaskInput) => {
  const task = await tx.task.create({ data, select: TASK_SELECT });

  await changeLogRepository.record(tx, {
    action: "CREATE",
    entityType: "TASK",
    entityId: task.id,
    entityLabel: task.title,
    after: task,
  });

  return task;
};

const updateAndRecord = async (
  tx: Prisma.TransactionClient,
  id: string,
  data: Prisma.TaskUncheckedUpdateInput,
) => {
  const before = await tx.task.findUniqueOrThrow({ where: { id } });
  const task = await tx.task.update({ where: { id }, data, select: TASK_SELECT });

  await changeLogRepository.record(tx, {
    action: "UPDATE",
    entityType: "TASK",
    entityId: id,
    entityLabel: task.title,
    before,
    after: data,
  });

  return task;
};

export const tasksRepository = {
  findAll: async (query: TasksQuery) => {
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      search,
      status,
      priority,
      category,
      assignedTo,
      overdue,
      dueDateFrom,
      dueDateTo,
      recurringTaskId,
      assetId,
    } = query;

    const field = resolveSortField(
      sortBy,
      TASK_ENTITY_ALLOWED_SORT_FIELDS,
      TASK_ENTITY_DEFAULT_SORT_FIELD,
    );
    const skip = getSkipValue(page, limit);
    const where = buildTasksWhere({
      search,
      status,
      priority,
      category,
      assignedTo,
      overdue,
      dueDateFrom,
      dueDateTo,
      recurringTaskId,
      assetId,
    });

    const [total, tasks] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        select: TASK_SELECT,
        orderBy: { [field]: sortOrder },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: tasks,
      meta: { total, page, limit, pages: getTotalPages(total, limit) },
    };
  },
  findById: async (id: string) =>
    prisma.task.findUnique({
      where: { id },
      select: TASK_SELECT,
    }),
  findIdById: (id: string) => prisma.task.findUnique({ where: { id }, select: { id: true } }),
  findOverdue: async () =>
    prisma.task.findMany({
      where: {
        dueDate: { lt: new Date() },
        status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
      },
      select: TASK_SELECT,
    }),
  // Tasks coming due within the lead window that haven't been reminded yet.
  // "Due soon" = due between now and now+leadDays, still open, has an assignee,
  // and no reminder sent yet (reminderSentAt guards against daily re-sends).
  findDueSoon: async (leadDays: number) => {
    const now = new Date();
    const windowEnd = addDays(now, leadDays);

    return prisma.task.findMany({
      where: {
        dueDate: { gte: now, lte: windowEnd },
        status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
        assignedTo: { not: null },
        reminderSentAt: null,
      },
      select: TASK_SELECT,
    });
  },
  markReminded: async (ids: string[]): Promise<void> => {
    await prisma.task.updateMany({
      where: { id: { in: ids } },
      data: { reminderSentAt: new Date() },
    });
  },
  create: (data: CreateTask) => prisma.$transaction((tx) => createAndRecord(tx, data)),
  // `db` lets a schedule generate its task inside the caller's transaction.
  createFromSchedule: (data: CreateTaskInput, db: Prisma.TransactionClient = prisma) =>
    createAndRecord(db, data),
  // `reminderSentAt` is an internal field (not part of UpdateTask): the service
  // resets it to null when a task is rescheduled, re-arming the due-soon reminder.
  update: (id: string, data: UpdateTask & { reminderSentAt?: Date | null }) =>
    prisma.$transaction((tx) => updateAndRecord(tx, id, data)),
  setBeforePhoto: async (id: string, beforePhotoUrl: string) =>
    prisma.task.update({
      where: { id },
      data: { beforePhotoUrl },
      select: TASK_SELECT,
    }),
  setAfterPhoto: async (id: string, afterPhotoUrl: string) =>
    prisma.task.update({
      where: { id },
      data: { afterPhotoUrl },
      select: TASK_SELECT,
    }),
  complete: async (id: string, { partsUsed }: CompleteTask) =>
    prisma.$transaction(async (tx) => {
      if (partsUsed.length > 0) {
        // Decrement all inventory quantities atomically
        await Promise.all(
          partsUsed.map(({ inventoryItemId, quantity }) =>
            tx.inventoryItem.update({
              where: { id: inventoryItemId },
              data: { quantity: { decrement: quantity } },
            }),
          ),
        );

        await tx.taskPartUsage.createMany({
          data: partsUsed.map(({ inventoryItemId, quantity }) => ({
            taskId: id,
            inventoryItemId,
            quantity,
          })),
        });
      }

      return updateAndRecord(tx, id, { status: TaskStatus.DONE, completedAt: new Date() });
    }),
  cancel: (id: string, { reason, cancelledBy }: { reason: string; cancelledBy: string }) =>
    prisma.$transaction((tx) =>
      updateAndRecord(tx, id, {
        status: TaskStatus.CANCELLED,
        cancellationReason: reason,
        cancelledAt: new Date(),
        cancelledBy,
      }),
    ),
  findActiveForUser: async (
    userId: string,
    excludeTaskId?: string,
    db: Prisma.TransactionClient = prisma,
  ) =>
    db.task.findFirst({
      where: {
        assignedTo: userId,
        status: { in: ACTIVE_TASK_STATUSES },
        ...(excludeTaskId ? { id: { not: excludeTaskId } } : {}),
      },
      select: { id: true },
    }),
  resetInProgressForUser: (userId: string): Promise<void> =>
    prisma.$transaction(async (tx) => {
      const reset = await tx.task.updateManyAndReturn({
        where: { assignedTo: userId, status: TaskStatus.IN_PROGRESS },
        data: { status: TaskStatus.OPEN },
        select: { id: true, title: true },
      });

      await Promise.all(
        reset.map((task) =>
          changeLogRepository.record(tx, {
            action: "UPDATE",
            entityType: "TASK",
            entityId: task.id,
            entityLabel: task.title,
            before: { status: TaskStatus.IN_PROGRESS },
            after: { status: TaskStatus.OPEN },
          }),
        ),
      );
    }),
  delete: (id: string): Promise<void> =>
    prisma.$transaction(async (tx) => {
      const before = await tx.task.findUniqueOrThrow({ where: { id } });

      await tx.task.delete({ where: { id } });
      await changeLogRepository.record(tx, {
        action: "DELETE",
        entityType: "TASK",
        entityId: id,
        entityLabel: before.title,
        before,
      });
    }),
};
