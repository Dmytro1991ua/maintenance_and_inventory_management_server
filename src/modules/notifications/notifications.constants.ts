import { Prisma } from "../../generated/prisma/client";

export const NOTIFICATION_SELECT = {
  id: true,
  type: true,
  message: true,
  isRead: true,
  userId: true,
  relatedEntityId: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

export const NOTIFICATION_NOT_FOUND_MESSAGE = "Notification not found";
