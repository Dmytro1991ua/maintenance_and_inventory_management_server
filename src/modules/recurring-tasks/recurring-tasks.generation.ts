import {
  type InventoryCategory,
  type Prisma,
  type TaskPriority,
  UserStatus,
} from "../../generated/prisma/client";
import { tasksRepository } from "../tasks/tasks.repository";
import { usersRepository } from "../users/users.repository";

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
 * meter firing). If the default assignee is busy or inactive, the task is created
 * unassigned rather than dropped.
 */
export const createScheduledTask = async (
  tx: Prisma.TransactionClient,
  schedule: ScheduleTemplate,
  { dueDate, description }: { dueDate: Date; description?: string },
) => {
  let assignedTo: string | undefined;

  if (schedule.assignedTo) {
    const assignee = await usersRepository.findStatus(schedule.assignedTo, tx);
    const available =
      assignee?.status === UserStatus.ACTIVE &&
      !(await tasksRepository.findActiveForUser(schedule.assignedTo, undefined, tx));

    assignedTo = available ? schedule.assignedTo : undefined;
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
