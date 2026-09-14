import { env, logger } from "../../../config";
import { NotificationType } from "../../../generated/prisma/client";
import { notificationsService } from "../../../modules/notifications/notifications.service";
import { isNotificationTypeEnabled } from "../../../modules/notifications/notifications.utils";
import { tasksRepository } from "../../../modules/tasks/tasks.repository";
import { usersRepository } from "../../../modules/users/users.repository";
import { emailService } from "../../../shared/email.service";

/**
 * Reminds assignees of tasks coming due within TASK_REMINDER_LEAD_DAYS, before
 * they slip overdue. Sends both an in-app notification and an email — each
 * gated by the assignee's TASK_DUE_SOON preference, so muting the type silences
 * both channels.
 *
 * reminderSentAt is set only for tasks actually reminded, so the daily run
 * doesn't re-notify the same assignee every morning until the due date; tasks
 * whose assignee opted out stay unmarked and are re-evaluated if they opt back
 * in before the task is due.
 */
export const checkDueSoonTasks = async (): Promise<void> => {
  const tasks = await tasksRepository.findDueSoon(env.TASK_REMINDER_LEAD_DAYS);

  if (!tasks.length) {
    logger.info({ job: "checkDueSoonTasks" }, "no tasks due soon");

    return;
  }

  const assignedTasks = tasks.filter((task) => task.assignedTo && task.assignee);

  const assigneeIds = [...new Set(assignedTasks.map((task) => task.assignedTo as string))];
  const preferenceRows = await usersRepository.findPreferencesByIds(assigneeIds);
  const preferencesById = new Map(
    preferenceRows.map((row) => [row.id, row.notificationPreferences]),
  );

  const eligible = assignedTasks.filter((task) =>
    isNotificationTypeEnabled(
      preferencesById.get(task.assignedTo as string) ?? null,
      NotificationType.TASK_DUE_SOON,
    ),
  );

  if (!eligible.length) {
    logger.info({ job: "checkDueSoonTasks" }, "no eligible assignees (all opted out)");

    return;
  }

  await notificationsService.createMany(
    NotificationType.TASK_DUE_SOON,
    eligible.map((task) => ({
      type: NotificationType.TASK_DUE_SOON,
      message: `Task due soon: "${task.title}" is due on ${task.dueDate?.toLocaleDateString()}.`,
      userId: task.assignedTo as string,
      relatedEntityId: task.id,
    })),
  );

  await Promise.all(
    eligible.map((task) =>
      emailService
        .sendTaskDueReminder(task.assignee!.email, {
          id: task.id,
          title: task.title,
          dueDate: task.dueDate,
        })
        .catch((err) => logger.warn({ err, taskId: task.id }, "Failed to send due-soon email")),
    ),
  );

  await tasksRepository.markReminded(eligible.map((task) => task.id));

  logger.info({ job: "checkDueSoonTasks", reminded: eligible.length }, "completed");
};
