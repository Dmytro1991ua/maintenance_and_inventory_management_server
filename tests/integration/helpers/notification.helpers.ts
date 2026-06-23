import { prisma } from "../../../src/config";
import type { Notification } from "../../../src/generated/prisma/client";

type CreateTestNotificationOptions = Partial<
  Pick<Notification, "type" | "message" | "isRead" | "userId" | "relatedEntityId">
> & {
  userId: string;
};

export const createTestNotification = (
  options: CreateTestNotificationOptions,
): Promise<Notification> =>
  prisma.notification.create({
    data: {
      type: options.type ?? "LOW_STOCK",
      message: options.message ?? "Low stock alert",
      isRead: options.isRead ?? false,
      userId: options.userId,
      relatedEntityId: options.relatedEntityId ?? null,
    },
  });
