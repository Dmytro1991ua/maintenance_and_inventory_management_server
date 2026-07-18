import { Prisma, TaskStatus } from "../../generated/prisma/client";

export const buildTasksWhere = (
  search?: string,
  status?: TaskStatus,
  assignedTo?: string,
  overdue?: boolean,
): Prisma.TaskWhereInput => {
  const normalizedSearch = search?.trim() || undefined;

  return {
    ...(normalizedSearch && {
      OR: [
        { title: { contains: normalizedSearch, mode: "insensitive" } },
        { description: { contains: normalizedSearch, mode: "insensitive" } },
      ],
    }),
    ...(status !== undefined && { status }),
    ...(assignedTo && { assignedTo }),
    ...(overdue && {
      dueDate: { lt: new Date() },
      status: { not: TaskStatus.DONE },
    }),
  };
};
