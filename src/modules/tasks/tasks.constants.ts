import { Prisma } from "../../generated/prisma/client";

export const TASK_ENTITY_ALLOWED_SORT_FIELDS = ["createdAt", "status", "title"] as const;
export const TASK_ENTITY_DEFAULT_SORT_FIELD = "createdAt" as const;

export const TASK_SELECT = {
  id: true,
  title: true,
  description: true,
  status: true,
  assignedTo: true,
  assignee: {
    select: {
      id: true,
      userName: true,
      email: true,
    },
  },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TaskSelect;
