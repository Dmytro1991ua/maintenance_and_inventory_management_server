import { prisma } from "../../../src/config";
import type { Task } from "../../../src/generated/prisma/client";

type CreateTestTaskOptions = Partial<
  Pick<Task, "title" | "description" | "status" | "assignedTo" | "dueDate">
>;

export const createTestTask = (options: CreateTestTaskOptions = {}): Promise<Task> =>
  prisma.task.create({
    data: {
      title: options.title ?? "Replace HVAC filter",
      description: options.description ?? null,
      status: options.status ?? "OPEN",
      assignedTo: options.assignedTo ?? null,
      dueDate: options.dueDate ?? null,
    },
  });
