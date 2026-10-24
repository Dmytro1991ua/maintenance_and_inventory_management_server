import { env, logger, prisma } from "../../config";
import { addDays } from "../../utils";
import { MAX_METER_READING } from "../meters/meters.constants";
import { ACTIVE_TASK_STATUSES } from "../tasks/tasks.constants";
import { createScheduledTask } from "./recurring-tasks.generation";
import { recurringTasksRepository } from "./recurring-tasks.repository";
import { buildMeterTaskDescription, nextGridThreshold } from "./recurring-tasks.utils";

type MeterSchedule = Awaited<
  ReturnType<typeof recurringTasksRepository.findActiveMeterSchedules>
>[number];

export type TriggeredTask = { id: string; title: string };

// Thrown inside the transaction to roll the threshold move back.
class OpenTaskError extends Error {}

/**
 * Fires a meter schedule for `reading` if its threshold was reached, creating the PM
 * task. Returns the task, or null when nothing fired.
 *
 * One transaction, in this order (a failure anywhere rolls all of it back):
 *  1. Guarded threshold update: locks the schedule row, so one concurrent firing wins.
 *  2. Open-task check, after the lock (before it, two firings could both pass). If one
 *     is open, roll back so the threshold stays put.
 *  3. Create the task.
 */
export const fireMeterSchedule = async (
  schedule: MeterSchedule,
  reading: number,
): Promise<TriggeredTask | null> => {
  const { intervalReading, firstDueReading, nextDueReading, meter } = schedule;

  // The CHECK constraint guarantees these for a meter schedule.
  if (intervalReading === null || firstDueReading === null || nextDueReading === null) return null;

  const next = nextGridThreshold(firstDueReading, intervalReading, reading);

  try {
    return await prisma.$transaction(async (tx) => {
      const { count } = await tx.recurringTask.updateMany({
        where: { id: schedule.id, isActive: true, nextDueReading: { lte: reading } },
        // A threshold past the largest storable reading can never be reached again.
        data: {
          nextDueReading: Math.min(next, MAX_METER_READING),
          ...(next > MAX_METER_READING && { isActive: false }),
        },
      });

      if (count === 0) return null;

      const openTask = await tx.task.findFirst({
        where: { recurringTaskId: schedule.id, status: { in: ACTIVE_TASK_STATUSES } },
        select: { id: true },
      });

      if (openTask) throw new OpenTaskError();

      const task = await createScheduledTask(tx, schedule, {
        dueDate: addDays(new Date(), env.METER_TASK_DUE_DAYS),
        description: buildMeterTaskDescription(
          schedule.description,
          meter ?? { name: "meter", unit: "" },
          reading,
          nextDueReading,
        ),
      });

      return { id: task.id, title: task.title };
    });
  } catch (err) {
    if (err instanceof OpenTaskError) return null;

    throw err;
  }
};

const isDue = (schedule: MeterSchedule, reading: number): boolean =>
  schedule.nextDueReading !== null && schedule.nextDueReading <= reading;

type FireTarget = { schedule: MeterSchedule; reading: number };

// Fires each target in turn. One failing mustn't stop the others or lose the caller's work.
const fireAll = async (
  targets: FireTarget[],
): Promise<{ tasks: TriggeredTask[]; failed: number }> => {
  const tasks: TriggeredTask[] = [];
  let failed = 0;

  for (const { schedule, reading } of targets) {
    try {
      const task = await fireMeterSchedule(schedule, reading);

      if (task) tasks.push(task);
    } catch (err) {
      failed++;
      logger.error({ err, scheduleId: schedule.id }, "Failed to fire meter schedule");
    }
  }

  return { tasks, failed };
};

/** After a reading is recorded: fires this meter's schedules that reached their threshold. */
export const evaluateMeterSchedules = async (
  meterId: string,
  reading: number,
): Promise<TriggeredTask[]> => {
  const schedules = await recurringTasksRepository.findActiveMeterSchedules(meterId);

  const { tasks } = await fireAll(
    schedules.filter((s) => isDue(s, reading)).map((schedule) => ({ schedule, reading })),
  );

  return tasks;
};

/** Nightly safety net: fires every due meter schedule against its meter's current reading. */
export const sweepMeterSchedules = async (): Promise<{
  checked: number;
  fired: number;
  failed: number;
}> => {
  const schedules = await recurringTasksRepository.findActiveMeterSchedules();

  const due = schedules.flatMap((schedule) =>
    schedule.meter && isDue(schedule, schedule.meter.currentReading)
      ? [{ schedule, reading: schedule.meter.currentReading }]
      : [],
  );

  const { tasks, failed } = await fireAll(due);

  return { checked: due.length, fired: tasks.length, failed };
};
