import { prisma } from "../../config";
import { TaskStatus } from "../../generated/prisma/client";
import { getSkipValue, getTotalPages, resolveSortField } from "../../utils";
import {
  ACTIVE_TASK_STATUSES,
  TASK_ENTITY_ALLOWED_SORT_FIELDS,
  TASK_ENTITY_DEFAULT_SORT_FIELD,
  TASK_SELECT,
} from "./tasks.constants";
import type { CreateTask, TasksQuery, UpdateTask } from "./tasks.schemas";
import { buildTasksWhere } from "./tasks.utils";

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
      assignedTo,
      overdue,
      dueDateFrom,
      dueDateTo,
    } = query;

    const field = resolveSortField(
      sortBy,
      TASK_ENTITY_ALLOWED_SORT_FIELDS,
      TASK_ENTITY_DEFAULT_SORT_FIELD,
    );
    const skip = getSkipValue(page, limit);
    const where = buildTasksWhere(
      search,
      status,
      priority,
      assignedTo,
      overdue,
      dueDateFrom,
      dueDateTo,
    );

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
  // Unpaginated — used by the overdue-task notification job, which needs
  // every matching task in one pass rather than a UI page at a time.
  // "Overdue" = past its due date and not yet completed.
  findOverdue: async () =>
    prisma.task.findMany({
      where: {
        dueDate: { lt: new Date() },
        status: { not: TaskStatus.DONE },
      },
      select: TASK_SELECT,
    }),
  create: async (data: CreateTask) =>
    prisma.task.create({
      data,
      select: TASK_SELECT,
    }),
  update: async (id: string, data: UpdateTask) =>
    prisma.task.update({
      where: { id },
      data,
      select: TASK_SELECT,
    }),
  findActiveForUser: async (userId: string, excludeTaskId?: string) =>
    prisma.task.findFirst({
      where: {
        assignedTo: userId,
        status: { in: ACTIVE_TASK_STATUSES },
        ...(excludeTaskId ? { id: { not: excludeTaskId } } : {}),
      },
      select: { id: true },
    }),
  resetInProgressForUser: async (userId: string): Promise<void> => {
    await prisma.task.updateMany({
      where: { assignedTo: userId, status: TaskStatus.IN_PROGRESS },
      data: { status: TaskStatus.OPEN },
    });
  },
  delete: async (id: string): Promise<void> => {
    await prisma.task.delete({ where: { id } });
  },
};
