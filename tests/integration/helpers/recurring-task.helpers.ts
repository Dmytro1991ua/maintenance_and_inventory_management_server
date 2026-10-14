import { prisma } from "../../../src/config";
import type {
  InventoryCategory,
  RecurringTask,
  TaskPriority,
} from "../../../src/generated/prisma/client";
import { createTestMeter } from "./meter.helpers";
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

type CreateTestMeterScheduleOptions = {
  meterId?: string;
  createdBy?: string;
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  category?: InventoryCategory | null;
  assignedTo?: string | null;
  intervalReading?: number;
  firstDueReading?: number;
  // Defaults to firstDueReading; set it to simulate a schedule partway through its life.
  nextDueReading?: number;
  isActive?: boolean;
};

// A meter-triggered schedule on `meterId` (or a fresh meter at reading 0), with the
// asset taken from the meter exactly as the API does.
export const createTestMeterSchedule = async (
  options: CreateTestMeterScheduleOptions = {},
): Promise<RecurringTask> => {
  const meter = options.meterId
    ? await prisma.meter.findUniqueOrThrow({ where: { id: options.meterId } })
    : await createTestMeter({ currentReading: 0 });
  const firstDueReading = options.firstDueReading ?? 250;

  return prisma.recurringTask.create({
    data: {
      title: options.title ?? "Change engine oil",
      description: options.description ?? null,
      priority: options.priority ?? "MEDIUM",
      category: options.category ?? null,
      assignedTo: options.assignedTo ?? null,
      triggerType: "METER",
      meterId: meter.id,
      assetId: meter.assetId,
      intervalReading: options.intervalReading ?? 250,
      firstDueReading,
      nextDueReading: options.nextDueReading ?? firstDueReading,
      isActive: options.isActive ?? true,
      createdBy: options.createdBy ?? (await createManagerUser()).id,
    },
  });
};
