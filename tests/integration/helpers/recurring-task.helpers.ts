import { prisma } from "../../../src/config";
import type {
  InventoryCategory,
  RecurringTask,
  TaskPriority,
} from "../../../src/generated/prisma/client";
import { createManagerUser } from "./user.helpers";

type CreateTestRecurringTaskOptions = {
  createdBy?: string;
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  category?: InventoryCategory | null;
  assignedTo?: string | null;
  intervalDays?: number;
  nextDueAt?: Date;
  isActive?: boolean;
};

// Defaults to a schedule that is already due, so tests of the generator don't
// have to set the date unless they care about it.
export const createTestRecurringTask = async (
  options: CreateTestRecurringTaskOptions = {},
): Promise<RecurringTask> =>
  prisma.recurringTask.create({
    data: {
      title: options.title ?? "Replace HVAC filter",
      description: options.description ?? null,
      priority: options.priority ?? "MEDIUM",
      category: options.category ?? null,
      assignedTo: options.assignedTo ?? null,
      intervalDays: options.intervalDays ?? 7,
      nextDueAt: options.nextDueAt ?? new Date("2026-01-05T00:00:00.000Z"),
      isActive: options.isActive ?? true,
      createdBy: options.createdBy ?? (await createManagerUser()).id,
    },
  });
