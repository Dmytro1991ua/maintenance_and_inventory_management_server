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
      await tasksRepository.createFromSchedule({
        title: schedule.title,
        description: schedule.description ?? undefined,
        priority: schedule.priority,
        category: schedule.category ?? undefined,
        assignedTo: schedule.assignedTo ?? undefined,
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
