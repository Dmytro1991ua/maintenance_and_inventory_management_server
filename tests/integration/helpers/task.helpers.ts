import { prisma } from "../../../src/config";
import type { Task } from "../../../src/generated/prisma/client";

type CreateTestTaskOptions = Partial<
  Pick<
    Task,
    | "title"
    | "description"
    | "status"
    | "priority"
    | "category"
    | "assignedTo"
    | "dueDate"
    | "beforePhotoUrl"
    | "afterPhotoUrl"
  >
>;

export const createTestTask = (options: CreateTestTaskOptions = {}): Promise<Task> =>
  prisma.task.create({
    data: {
      title: options.title ?? "Replace HVAC filter",
      description: options.description ?? null,
      status: options.status ?? "OPEN",
      priority: options.priority ?? "MEDIUM",
      category: options.category ?? null,
      assignedTo: options.assignedTo ?? null,
      dueDate: options.dueDate ?? null,
      beforePhotoUrl: options.beforePhotoUrl ?? null,
      afterPhotoUrl: options.afterPhotoUrl ?? null,
    },
  });

export const createTestChecklistTemplate = (
  category: string,
  items: string[],
) =>
  prisma.checklistTemplate.upsert({
    where: { category: category as never },
    update: { items },
    create: { category: category as never, items },
  });
