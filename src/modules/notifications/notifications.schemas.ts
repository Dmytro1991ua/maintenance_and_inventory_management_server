import { z } from "zod";

export const NotificationsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
    limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
    // z.coerce.boolean() would parse the literal string "false" as true —
    // any non-empty string is truthy in JS. z.stringbool() handles "true"/
    // "false" query-string values correctly.
    isRead: z.stringbool().optional().openapi({ example: false }),
    type: z.enum(["LOW_STOCK", "TASK_OVERDUE"]).optional().openapi({ example: "LOW_STOCK" }),
  })
  .strict()
  .openapi("NotificationsQuery");

export const UpdateNotificationSchema = z
  .object({
    isRead: z.boolean().openapi({ example: true }),
  })
  .strict()
  .openapi("UpdateNotificationInput");

export const NotificationIdParamSchema = z.object({
  id: z.uuid({ error: "Invalid notification ID" }),
});

export const CreateNotificationSchema = z.object({
  type: z.enum(["LOW_STOCK", "TASK_OVERDUE"]),
  message: z.string().min(1).max(500),
  userId: z.uuid(),
  relatedEntityId: z.uuid().optional(),
});

// — Response schemas — documentation only ——————————————————————————————————

export const NotificationSchema = z
  .object({
    id: z.uuid(),
    type: z.enum(["LOW_STOCK", "TASK_OVERDUE"]),
    message: z.string().openapi({ example: 'Low stock: "Cordless Drill" has 2 units (min: 5).' }),
    isRead: z.boolean(),
    userId: z.uuid(),
    relatedEntityId: z.uuid().nullable(),
    createdAt: z.iso.datetime(),
  })
  .openapi("Notification");

export const NotificationResponseSchema = z
  .object({
    success: z.literal(true),
    data: NotificationSchema,
  })
  .openapi("NotificationResponse");

export const NotificationsListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(NotificationSchema),
    meta: z.object({
      total: z.number(),
      page: z.number(),
      limit: z.number(),
      pages: z.number(),
    }),
  })
  .openapi("NotificationsListResponse");

export const UnreadCountResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      count: z.number().openapi({ example: 3 }),
    }),
  })
  .openapi("UnreadCountResponse");

export const MarkAllReadResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      updated: z.number().openapi({ example: 5 }),
    }),
  })
  .openapi("MarkAllReadResponse");

export type NotificationsQuery = z.infer<typeof NotificationsQuerySchema>;
export type UpdateNotification = z.infer<typeof UpdateNotificationSchema>;
export type NotificationIdParam = z.infer<typeof NotificationIdParamSchema>;
export type CreateNotification = z.infer<typeof CreateNotificationSchema>;
