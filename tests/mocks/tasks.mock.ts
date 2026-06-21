import { Task } from "../../src/generated/prisma/client";

export const buildTask = (overrides: Partial<Task> = {}) => ({
  id: "task-1",
  title: "Replace HVAC filter",
  description: null,
  status: "OPEN" as const,
  assignedTo: "user-tech",
  dueDate: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});
