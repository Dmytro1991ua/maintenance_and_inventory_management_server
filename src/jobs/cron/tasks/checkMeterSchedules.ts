import { logger } from "../../../config";
import { sweepMeterSchedules } from "../../../modules/recurring-tasks/recurring-tasks.meter";

/**
 * Nightly safety net for meter schedules that were due but didn't fire when their
 * reading was recorded (a crash, or an open task that has since closed).
 */
export const checkMeterSchedules = async (): Promise<void> => {
  const { checked, fired } = await sweepMeterSchedules();

  logger.info({ job: "checkMeterSchedules", checked, fired }, "completed");
};
