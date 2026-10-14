import type { InventoryCategory, Prisma, TaskPriority } from "../../generated/prisma/client";
import { tasksRepository } from "../tasks/tasks.repository";

type ScheduleTemplate = {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  category: InventoryCategory | null;
  assignedTo: string | null;
  assetId: string | null;
};

/**
 * Creates a schedule's task inside the caller's transaction (shared by the cron and
 * meter firing). If the default assignee is busy, the task is created unassigned
 * rather than dropped.
 */
export const createScheduledTask = async (
  tx: Prisma.TransactionClient,
  schedule: ScheduleTemplate,
  { dueDate, description }: { dueDate: Date; description?: string },
) => {
  let assignedTo: string | undefined;

  if (schedule.assignedTo) {
    const activeTask = await tasksRepository.findActiveForUser(schedule.assignedTo, undefined, tx);

    assignedTo = activeTask ? undefined : schedule.assignedTo;
  }

  return tasksRepository.createFromSchedule(
    {
      title: schedule.title,
      description: description ?? schedule.description ?? undefined,
      priority: schedule.priority,
      category: schedule.category ?? undefined,
      assignedTo,
      assetId: schedule.assetId ?? undefined,
      dueDate,
      recurringTaskId: schedule.id,
    },
    tx,
  );
};
