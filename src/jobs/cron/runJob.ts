import { logger } from "../../config";

/**
 * Wraps a job's execution with consistent start/failure logging and a safety
 * net — cron callbacks must never throw, or an unhandled rejection could
 * crash the process and take down HTTP traffic with it.
 */
export const runJob = async (name: string, task: () => Promise<void>): Promise<void> => {
  logger.info({ job: name }, "started");

  try {
    await task();
  } catch (err) {
    logger.error({ job: name, err }, "failed");
  }
};

/** Call after a loop that survives item failures, so the run is recorded as failed. */
export const assertNoFailures = (failed: number, total: number, what: string): void => {
  if (failed > 0) throw new Error(`${failed} of ${total} ${what}`);
};
