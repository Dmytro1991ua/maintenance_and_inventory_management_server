import { prisma } from "../../config";
import { NotificationType } from "../../generated/prisma/client";
import { getSkipValue, getTotalPages } from "../../utils";
import { NOTIFICATION_SELECT } from "./notifications.constants";
import type {
  CreateNotification,
  NotificationsQuery,
  UpdateNotification,
} from "./notifications.schemas";
import { buildDedupeKey, buildNotificationsWhere } from "./notifications.utils";

export const notificationsRepository = {
  findAll: async (userId: string, query: NotificationsQuery) => {
    const { page, limit, isRead, type } = query;

    const skip = getSkipValue(page, limit);
    const where = buildNotificationsWhere(userId, isRead, type);

    const [total, notifications] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        select: NOTIFICATION_SELECT,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: notifications,
      meta: { total, page, limit, pages: getTotalPages(total, limit) },
    };
  },
  findById: async (id: string) =>
    prisma.notification.findUnique({
      where: { id },
      select: NOTIFICATION_SELECT,
    }),
  countUnread: async (userId: string): Promise<number> =>
    prisma.notification.count({
      where: { userId, isRead: false },
    }),
  createMany: async (data: CreateNotification[]): Promise<number> => {
    const result = await prisma.notification.createMany({ data });

    return result.count;
  },
  // Used by system jobs (low-stock / overdue-task checks) to avoid re-notifying
  // about an entity that already has an open (unread) notification of the same type
  findActiveDuplicateKeys: async (
    type: NotificationType,
    relatedEntityIds: string[],
  ): Promise<Set<string>> => {
    if (relatedEntityIds.length === 0) return new Set();

    const existing = await prisma.notification.findMany({
      where: { type, isRead: false, relatedEntityId: { in: relatedEntityIds } },
      select: { userId: true, relatedEntityId: true },
    });

    return new Set(
      existing.flatMap((notification) =>
        notification.relatedEntityId
          ? [buildDedupeKey(notification.userId, notification.relatedEntityId)]
          : [],
      ),
    );
  },
  update: async (id: string, data: UpdateNotification) =>
    prisma.notification.update({
      where: { id },
      data,
      select: NOTIFICATION_SELECT,
    }),
  markAllAsRead: async (userId: string): Promise<number> => {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return result.count; // how many were updated
  },
  delete: async (id: string): Promise<void> => {
    await prisma.notification.delete({ where: { id } });
  },
};
