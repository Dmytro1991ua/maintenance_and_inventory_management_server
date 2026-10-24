import { logger, prisma } from "../../../config";
import { createScheduledTask } from "../../../modules/recurring-tasks/recurring-tasks.generation";
import { recurringTasksRepository } from "../../../modules/recurring-tasks/recurring-tasks.repository";

type DueSchedule = Awaited<ReturnType<typeof recurringTasksRepository.findDue>>[number];

const generateTaskAndAdvance = async (schedule: DueSchedule): Promise<boolean> => {
  const { intervalDays, nextDueAt } = schedule;

  if (!intervalDays || !nextDueAt) return false;

  await prisma.$transaction(async (tx) => {
    await createScheduledTask(tx, schedule, { dueDate: nextDueAt });
    await recurringTasksRepository.advanceNextDueAt(schedule.id, intervalDays, nextDueAt, tx);
  });

  return true;
};

export const generateRecurringTasks = async (): Promise<void> => {
  const due = await recurringTasksRepository.findDue();

  if (!due.length) {
    logger.info({ job: "generateRecurringTasks" }, "no schedules due");
    return;
  }

  let generated = 0;
  let failed = 0;

  // Sequential: each schedule sees the previous one's task; a failure doesn't stop the rest.
  for (const schedule of due) {
    try {
      if (await generateTaskAndAdvance(schedule)) generated++;
    } catch (err) {
      failed++;
      logger.error({ err, scheduleId: schedule.id }, "Failed to generate recurring task");
    }
  }

  logger.info({ job: "generateRecurringTasks", generated, failed }, "completed");

  if (failed > 0) throw new Error(`${failed} of ${due.length} schedules failed to generate`);
};
