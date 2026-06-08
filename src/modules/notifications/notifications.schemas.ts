import { z } from "zod";

export const NotificationsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    isRead: z.coerce.boolean().optional(), // filter by read/unread
  })
  .strict();

export const UpdateNotificationSchema = z
  .object({
    isRead: z.boolean(),
  })
  .strict();

export const NotificationIdParamSchema = z.object({
  id: z.uuid({ error: "Invalid notification ID" }),
});

export const CreateNotificationSchema = z.object({
  type: z.enum(["LOW_STOCK", "TASK_OVERDUE"]),
  message: z.string().min(1).max(500),
  userId: z.uuid(),
  relatedEntityId: z.uuid().optional(),
});

export type NotificationsQuery = z.infer<typeof NotificationsQuerySchema>;
export type UpdateNotification = z.infer<typeof UpdateNotificationSchema>;
export type NotificationIdParam = z.infer<typeof NotificationIdParamSchema>;
export type CreateNotification = z.infer<typeof CreateNotificationSchema>;
