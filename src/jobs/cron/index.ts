import cron, { type ScheduledTask } from "node-cron";

import { logger } from "../../config";
import { DAILY_AT_MIDNIGHT, JOB_LOCK_TTL_MS } from "./constants";
import { checkLowStock } from "./inventory";
import { runJob } from "./runJob";
import { checkOverdueTasks } from "./tasks";
import { withLock } from "./withLock";

const JOBS = [
  { name: "checkLowStock", task: checkLowStock },
  { name: "checkOverdueTasks", task: checkOverdueTasks },
];

/**
 * Registers all cron schedules and returns their handles so the caller can
 * stop them during graceful shutdown.
 * Called once from server.ts after all dependencies are verified healthy.
 *
 * Schedules:
 *   checkLowStock      → daily at midnight
 *   checkOverdueTasks  → daily at midnight
 *
 * Multi-instance safety:
 * Every instance still registers and fires these schedules independently,
 * but each run first acquires a short-lived Redis lock (see withLock) keyed
 * by job name — only the instance that wins the lock executes the job, the
 * rest find it already held and skip that tick entirely.
 */
export const registerJobs = (): ScheduledTask[] => {
  const jobs = JOBS.map(({ name, task }) =>
    cron.schedule(DAILY_AT_MIDNIGHT, () =>
      withLock(`cron:lock:${name}`, JOB_LOCK_TTL_MS, () => runJob(name, task)),
    ),
  );

  logger.info("cron: all jobs registered");

  return jobs;
};
