import { Prisma } from "../../generated/prisma/client";

export const MAX_ENTRY_MINUTES = 24 * 60;

export const TIME_ENTRY_NOT_FOUND_MESSAGE = "Time entry not found";
export const TIME_ENTRY_CANCELLED_TASK_MESSAGE = "Cannot log time on a cancelled task";
export const TIME_ENTRY_NOT_ASSIGNEE_MESSAGE = "You can only log time on tasks assigned to you";
export const TIME_ENTRY_FUTURE_DATE_MESSAGE = "Work date cannot be in the future";
export const TIME_ENTRY_NOT_OWNER_MESSAGE = "You can only delete your own time entries";

export const TIME_ENTRY_SELECT = {
  id: true,
  taskId: true,
  minutes: true,
  workedOn: true,
  note: true,
  hourlyRate: true,
  createdAt: true,
  user: { select: { id: true, userName: true } },
} satisfies Prisma.TaskTimeEntrySelect;
