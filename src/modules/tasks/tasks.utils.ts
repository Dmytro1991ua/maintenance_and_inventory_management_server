import { InventoryCategory, Prisma, TaskPriority, TaskStatus } from "../../generated/prisma/client";

type TasksWhereOptions = {
  search?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  category?: InventoryCategory;
  assignedTo?: string;
  overdue?: boolean;
  dueDateFrom?: Date;
  dueDateTo?: Date;
  recurringTaskId?: string;
};

export const buildTasksWhere = ({
  search,
  status,
  priority,
  category,
  assignedTo,
  overdue,
  dueDateFrom,
  dueDateTo,
  recurringTaskId,
}: TasksWhereOptions): Prisma.TaskWhereInput => {
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
    ...(priority !== undefined && { priority }),
    ...(category !== undefined && { category }),
    ...(assignedTo && { assignedTo }),
    ...(dueDateFilter && { dueDate: dueDateFilter }),
    ...(overdue && { status: { not: TaskStatus.DONE } }),
    ...(recurringTaskId && { recurringTaskId }),
  };
};
