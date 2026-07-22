import { NotificationType, Prisma } from "../../generated/prisma/client";

export const buildNotificationsWhere = (
  userId: string,
  isRead?: boolean,
  type?: NotificationType,
): Prisma.NotificationWhereInput => ({
  userId,
  ...(isRead !== undefined && { isRead }),
  ...(type !== undefined && { type }),
});

/**
 * Identifies a (recipient, triggering entity) pair for de-dup purposes —
 * used by system jobs to avoid creating a second open notification about
 * the same ongoing condition (e.g. the same low-stock item) for the same user.
 */
export const buildDedupeKey = (userId: string, relatedEntityId: string): string =>
  `${userId}:${relatedEntityId}`;
