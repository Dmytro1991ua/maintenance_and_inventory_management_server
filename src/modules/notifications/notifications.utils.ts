import { NotificationType, Prisma } from "../../generated/prisma/client";

// Returns true when the user has not explicitly opted out of this notification type.
// Prisma's Json field is JsonValue (string | number | boolean | null | JsonObject | JsonArray),
// so we must narrow to JsonObject before indexing. Any non-object value (corrupt data, null)
// defaults to enabled — aligns with the opt-out model where missing key = subscribed.
export const isNotificationTypeEnabled = (
  preferences: Prisma.JsonValue,
  type: NotificationType,
): boolean => {
  if (typeof preferences !== "object" || preferences === null || Array.isArray(preferences))
    return true;

  return preferences[type] !== false;
};

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
