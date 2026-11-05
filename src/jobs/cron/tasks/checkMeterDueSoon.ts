import { logger } from "../../../config";
import { NotificationType, Role } from "../../../generated/prisma/client";
import { notificationsRepository } from "../../../modules/notifications/notifications.repository";
import { notificationsService } from "../../../modules/notifications/notifications.service";
import { recurringTasksRepository } from "../../../modules/recurring-tasks/recurring-tasks.repository";
import { buildMeterServiceDueMessage } from "../../../modules/recurring-tasks/recurring-tasks.utils";
import { usersRepository } from "../../../modules/users/users.repository";
import { assertNoFailures, processEach } from "../runJob";

/**
 * Tells ADMIN/MANAGER users when a meter schedule enters its due-soon window.
 * A schedule is marked once someone is notified, per threshold, so it re-arms
 * itself when the threshold advances. All-muted schedules are retried next run.
 */
export const checkMeterDueSoon = async (): Promise<void> => {
  const [schedules, recipients] = await Promise.all([
    recurringTasksRepository.findMeterSchedulesDueSoon(),
    usersRepository.findByRoles([Role.ADMIN, Role.MANAGER]),
  ]);

  if (!schedules.length || !recipients.length) {
    logger.info(
      { job: "checkMeterDueSoon", schedules: schedules.length, recipients: recipients.length },
      "nothing to notify",
    );

    return;
  }

  const type = NotificationType.METER_SERVICE_DUE;
  let reminded = 0;

  const failed = await processEach("checkMeterDueSoon", schedules, async (schedule) => {
    const message = buildMeterServiceDueMessage(
      schedule.title,
      { name: schedule.meterName, unit: schedule.unit },
      schedule.currentReading,
      schedule.nextDueReading,
    );
    // An unread reminder for an earlier threshold is stale, and would block this one.
    await notificationsRepository.markRelatedAsRead(type, schedule.id);

    const { created } = await notificationsService.createMany(
      type,
      recipients.map(({ id }) => ({ type, message, userId: id, relatedEntityId: schedule.id })),
    );

    if (created > 0) {
      await recurringTasksRepository.markMeterReminded(schedule.id, schedule.nextDueReading);
      reminded++;
    }
  });

  assertNoFailures(failed, schedules.length, "meter schedules failed to remind");

  logger.info({ job: "checkMeterDueSoon", candidates: schedules.length, reminded }, "completed");
};
