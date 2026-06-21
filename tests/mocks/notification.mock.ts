import { Notification } from "../../src/generated/prisma/client";

export const buildNotification = (overrides: Partial<Notification> = {}) => ({
  id: "notification-1",
  type: "LOW_STOCK" as const,
  message: "Low stock alert",
  isRead: false,
  userId: "user-1",
  relatedEntityId: "item-1",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});
