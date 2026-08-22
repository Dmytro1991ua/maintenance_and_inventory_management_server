import { Prisma } from "../../generated/prisma/client";

export const RECURRING_TASK_SELECT = {
  id: true,
  title: true,
  description: true,
  priority: true,
  category: true,
  assignedTo: true,
  assignee: {
    select: {
      id: true,
      userName: true,
      email: true,
    },
  },
  intervalDays: true,
  nextDueAt: true,
  isActive: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RecurringTaskSelect;

export const RECURRING_TASK_NOT_FOUND_MESSAGE = "Recurring task not found";
