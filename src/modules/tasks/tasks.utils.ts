import { Prisma, TaskStatus } from "../../generated/prisma/client";

export const buildTasksWhere = (
  status?: TaskStatus,
  assignedTo?: string,
): Prisma.TaskWhereInput | undefined => {
  const conditions: Prisma.TaskWhereInput[] = [];

  if (status) conditions.push({ status: { equals: status } });
  if (assignedTo) conditions.push({ assignedTo: { equals: assignedTo } });

  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];

  return { AND: conditions };
};
