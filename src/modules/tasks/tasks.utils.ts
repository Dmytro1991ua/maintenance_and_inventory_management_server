import { Prisma, TaskStatus } from "../../generated/prisma/client";

export const buildTasksWhere = (
  status?: TaskStatus,
  assignedTo?: string,
): Prisma.TaskWhereInput => ({
  ...(status !== undefined && { status }),
  ...(assignedTo && { assignedTo }),
});
