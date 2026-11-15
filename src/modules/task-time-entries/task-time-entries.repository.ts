import { prisma } from "../../config";
import type { Prisma } from "../../generated/prisma/client";
import { TIME_ENTRY_SELECT } from "./task-time-entries.constants";

export const taskTimeEntriesRepository = {
  findAllByTaskId: (taskId: string) =>
    prisma.taskTimeEntry.findMany({
      where: { taskId },
      select: TIME_ENTRY_SELECT,
      orderBy: [{ workedOn: "asc" }, { createdAt: "asc" }],
    }),

  findById: (id: string) =>
    prisma.taskTimeEntry.findUnique({ where: { id }, select: TIME_ENTRY_SELECT }),

  create: (data: {
    taskId: string;
    userId: string;
    minutes: number;
    workedOn: Date;
    note?: string;
    hourlyRate: Prisma.Decimal | null;
  }) => prisma.taskTimeEntry.create({ data, select: TIME_ENTRY_SELECT }),

  delete: (id: string) => prisma.taskTimeEntry.delete({ where: { id } }),
};
