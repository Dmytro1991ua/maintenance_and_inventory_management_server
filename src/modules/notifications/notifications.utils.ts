import { Prisma } from "../../generated/prisma/client";

export const buildNotificationsWhere = (
  userId: string,
  isRead?: boolean,
): Prisma.NotificationWhereInput => ({
  // userId is always required — users only see their own notifications
  userId,
  ...(isRead !== undefined && { isRead }),
});

/**
 * Identifies a (recipient, triggering entity) pair for de-dup purposes —
 * used by system jobs to avoid creating a second open notification about
 * the same ongoing condition (e.g. the same low-stock item) for the same user.
 */
export const buildDedupeKey = (userId: string, relatedEntityId: string): string =>
  `${userId}:${relatedEntityId}`;
