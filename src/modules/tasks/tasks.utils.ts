import { Prisma, TaskStatus } from "../../generated/prisma/client";

export const buildTasksWhere = (
  search?: string,
  status?: TaskStatus,
  assignedTo?: string,
  overdue?: boolean,
  dueDateFrom?: Date,
  dueDateTo?: Date,
): Prisma.TaskWhereInput => {
  const normalizedSearch = search?.trim() || undefined;

  const hasDueDateCondition = dueDateFrom || dueDateTo || overdue;
  const dueDateFilter = hasDueDateCondition
    ? {
        ...(dueDateFrom && { gte: dueDateFrom }),
        ...(dueDateTo && { lte: dueDateTo }),
        ...(overdue && { lt: new Date() }),
      }
    : undefined;

  return {
    ...(normalizedSearch && {
      OR: [
        { title: { contains: normalizedSearch, mode: "insensitive" } },
        { description: { contains: normalizedSearch, mode: "insensitive" } },
      ],
    }),
    ...(status !== undefined && { status }),
    ...(assignedTo && { assignedTo }),
    ...(dueDateFilter && { dueDate: dueDateFilter }),
    ...(overdue && { status: { not: TaskStatus.DONE } }),
  };
};
