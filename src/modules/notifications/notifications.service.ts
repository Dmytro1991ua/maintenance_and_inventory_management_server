import { NotificationType } from "../../generated/prisma/client";
import { ensureOwner, findOrThrow } from "../../utils";
import { NOTIFICATION_NOT_FOUND_MESSAGE } from "./notifications.constants";
import { notificationsRepository } from "./notifications.repository";
import type {
  CreateNotification,
  NotificationsQuery,
  UpdateNotification,
} from "./notifications.schemas";
import { buildDedupeKey } from "./notifications.utils";

export const notificationsService = {
  findAll: async (userId: string, query: NotificationsQuery) => {
    return notificationsRepository.findAll(userId, query);
  },
  countUnread: async (userId: string) => {
    const count = await notificationsRepository.countUnread(userId);

    return { count };
  },
  update: async (id: string, data: UpdateNotification, userId: string) => {
    const notification = await findOrThrow(
      () => notificationsRepository.findById(id),
      NOTIFICATION_NOT_FOUND_MESSAGE,
    );

    // Users can only update their own notifications
    ensureOwner(notification.userId, userId, "You can only update your own notifications");

    return notificationsRepository.update(id, data);
  },
  markAllAsRead: async (userId: string) => {
    const count = await notificationsRepository.markAllAsRead(userId);

    return { updated: count };
  },
  delete: async (id: string, userId: string): Promise<void> => {
    const notification = await findOrThrow(
      () => notificationsRepository.findById(id),
      NOTIFICATION_NOT_FOUND_MESSAGE,
    );

    // Users can only delete their own notifications
    ensureOwner(notification.userId, userId, "You can only delete your own notifications");

    await notificationsRepository.delete(id);
  },
  // Used by system jobs (low-stock / overdue-task checks) to fan out
  // notifications to multiple recipients in one batch. Entries are expected to
  // share the same `type` and carry a `relatedEntityId`.
  createMany: async (type: NotificationType, notifications: CreateNotification[]) => {
    if (notifications.length === 0) return { created: 0, skipped: 0 };

    const relatedEntityIds = notifications.flatMap((notification) =>
      notification.relatedEntityId ? [notification.relatedEntityId] : [],
    );

    const duplicateKeys = await notificationsRepository.findActiveDuplicateKeys(
      type,
      relatedEntityIds,
    );

    // Drop entries that would duplicate an existing unread notification for the
    // same (user, entity) pair — otherwise an ongoing condition (e.g. an item
    // still below its stock threshold) would spam the same user every run.
    const notificationsToInsert = notifications.filter(
      (notification) =>
        !notification.relatedEntityId ||
        !duplicateKeys.has(buildDedupeKey(notification.userId, notification.relatedEntityId)),
    );

    if (notificationsToInsert.length === 0) {
      return { created: 0, skipped: notifications.length };
    }

    const created = await notificationsRepository.createMany(notificationsToInsert);

    return { created, skipped: notifications.length - notificationsToInsert.length };
  },
};
