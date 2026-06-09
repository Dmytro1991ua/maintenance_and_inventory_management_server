import { logger } from "../../../config";
import { NotificationType } from "../../../generated/prisma/client";
import { notificationsService } from "../../../modules/notifications/notifications.service";
import { tasksRepository } from "../../../modules/tasks/tasks.repository";

/**
 * Checks for tasks that are past their due date and not yet completed, then
 * creates TASK_OVERDUE notifications for their assignees.
 *
 * Only tasks with an assignee are notified — unassigned overdue tasks have
 * no natural recipient for a personal notification.
 */
export const checkOverdueTasks = async (): Promise<void> => {
  const overdueTasks = await tasksRepository.findOverdue();

  if (!overdueTasks.length) {
    logger.info({ job: "checkOverdueTasks" }, "no overdue tasks");

    return;
  }

  const notifications = overdueTasks.flatMap((task) => {
    if (!task.assignedTo) return [];

    return [
      {
        type: NotificationType.TASK_OVERDUE,
        message: `Task overdue: "${task.title}" was due on ${task.dueDate?.toLocaleDateString()} and is still ${task.status}.`,
        userId: task.assignedTo,
        relatedEntityId: task.id,
      },
    ];
  });

  if (!notifications.length) {
    logger.info({ job: "checkOverdueTasks" }, "no assigned overdue tasks");

    return;
  }

  const result = await notificationsService.createMany(
    NotificationType.TASK_OVERDUE,
    notifications,
  );

  logger.info(
    { job: "checkOverdueTasks", created: result.created, skipped: result.skipped },
    "completed",
  );
};
