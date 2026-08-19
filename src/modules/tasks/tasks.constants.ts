import { Prisma, TaskStatus } from "../../generated/prisma/client";

export const ACTIVE_TASK_STATUSES = [TaskStatus.OPEN, TaskStatus.IN_PROGRESS];

export const TASK_ENTITY_ALLOWED_SORT_FIELDS = [
  "createdAt",
  "priority",
  "status",
  "title",
] as const;
export const TASK_ENTITY_DEFAULT_SORT_FIELD = "createdAt" as const;

export const TASK_SELECT = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  category: true,
  assignedTo: true,
  dueDate: true,
  beforePhotoUrl: true,
  afterPhotoUrl: true,
  cancellationReason: true,
  cancelledAt: true,
  cancelledBy: true,
  assignee: {
    select: {
      id: true,
      userName: true,
      email: true,
    },
  },
  partsUsed: {
    select: {
      id: true,
      inventoryItemId: true,
      quantity: true,
      inventoryItem: { select: { name: true, serialNumber: true } },
    },
  },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TaskSelect;

export const ASSIGNEE_NOT_FOUND_MESSAGE = "Assignee not found";
