import { Prisma } from "../../generated/prisma/client";

const SCHEDULE_FIELDS = {
  id: true,
  title: true,
  description: true,
  priority: true,
  category: true,
  assignedTo: true,
  assetId: true,
} as const;

export const RECURRING_TASK_SELECT = {
  ...SCHEDULE_FIELDS,
  assignee: {
    select: {
      id: true,
      userName: true,
      email: true,
    },
  },
  asset: { select: { id: true, name: true, serialNumber: true } },
  triggerType: true,
  intervalDays: true,
  nextDueAt: true,
  meterId: true,
  meter: { select: { id: true, name: true, unit: true, currentReading: true } },
  intervalReading: true,
  firstDueReading: true,
  nextDueReading: true,
  isActive: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RecurringTaskSelect;

export const METER_SCHEDULE_SELECT = {
  ...SCHEDULE_FIELDS,
  intervalReading: true,
  firstDueReading: true,
  nextDueReading: true,
  meter: { select: { id: true, name: true, unit: true, currentReading: true } },
} satisfies Prisma.RecurringTaskSelect;

export const RECURRING_TASK_NOT_FOUND_MESSAGE = "Recurring task not found";

export const METER_SCHEDULE_FIXED_MESSAGE =
  "A meter schedule's interval and asset come from its meter and can't be changed";
