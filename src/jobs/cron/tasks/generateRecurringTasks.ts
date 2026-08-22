import { logger } from "../../../config";
import { recurringTasksRepository } from "../../../modules/recurring-tasks/recurring-tasks.repository";
import { tasksRepository } from "../../../modules/tasks/tasks.repository";

export const generateRecurringTasks = async (): Promise<void> => {
  const due = await recurringTasksRepository.findDue();

  if (!due.length) {
    logger.info({ job: "generateRecurringTasks" }, "no schedules due");
    return;
  }

  let generated = 0;

  await Promise.all(
    due.map(async (schedule) => {
      // Respect the single-active-task rule: if the default assignee already
      // has an active task when the cron fires, create the task unassigned so
      // a manager can pick it up — never silently drop a PM task.
      let assignedTo: string | undefined;

      if (schedule.assignedTo) {
        const activeTask = await tasksRepository.findActiveForUser(schedule.assignedTo);

        assignedTo = activeTask ? undefined : schedule.assignedTo;
      }

      await tasksRepository.createFromSchedule({
        title: schedule.title,
        description: schedule.description ?? undefined,
        priority: schedule.priority,
        category: schedule.category ?? undefined,
        assignedTo,
        dueDate: schedule.nextDueAt,
        recurringTaskId: schedule.id,
      });

      await recurringTasksRepository.advanceNextDueAt(
        schedule.id,
        schedule.intervalDays,
        schedule.nextDueAt,
      );

      generated++;
    }),
  );

  logger.info({ job: "generateRecurringTasks", generated }, "completed");
};
